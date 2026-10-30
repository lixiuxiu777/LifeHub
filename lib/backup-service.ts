import {z} from 'zod';
import {ApiError} from './api-error';
import {authorize,json,readJson,digest} from './auth-service';
import {parseBackup,backupScopeNames,validateRecordGraph,parentOf,type Entity,type BackupScope} from './domain';
import {readState} from './state-service';
import {protectHabitHistory} from './life-service';
import {backupScopes,canonical} from '../public/js/backup-data.js';

const modes=['merge','replace'] as const;
type Mode=typeof modes[number];
type Conflict={id?:string;type?:string;title?:string;reason:string};
const summaryTitle=(r:Entity)=>{const d=r.data as any;return String(d.title||d.month||d.date||r.type).slice(0,160);};
const same=(a:Entity,b:Entity)=>a.type===b.type&&canonical(a.data)===canonical(b.data);
function businessKey(r:Entity){const d=r.data as any;if(r.type==='DashboardPreference')return 'preference';if(r.type==='Budget')return canonical(['budget',d.month,d.currency,d.category]);if(r.type==='HabitCheckIn')return canonical(['checkin',d.habitId,d.date]);return null;}

export function planBackup(current:Entity[],incoming:Entity[],scope:BackupScope,mode:Mode){
  const types=backupScopes[scope].types,existing=new Map(current.map(r=>[r.id,r]));const conflicts:Conflict[]=[];
  const affected=current.filter(r=>types.includes(r.type));let added=0,updated=0,unchanged=0;
  for(const record of incoming){const old=existing.get(record.id);
    if(!old)added++;
    else if(old.type!==record.type)conflicts.push({id:record.id,type:record.type,title:summaryTitle(record),reason:'记录 ID 已对应另一种类型，不能改变记录身份'});
    else if(same(old,record))unchanged++;
    else{updated++;if(mode==='merge')conflicts.push({id:record.id,type:record.type,title:summaryTitle(record),reason:'同 ID 内容不同；合并模式不会覆盖，请核对后选择替换范围'});}
  }
  const prospective=mode==='replace'?current.filter(r=>!types.includes(r.type)).concat(incoming):current.concat(incoming.filter(r=>!existing.has(r.id)));
  const keys=new Map<string,Entity>();
  for(const record of prospective){const key=businessKey(record);if(key&&keys.has(key)){conflicts.push({id:record.id,type:record.type,title:summaryTitle(record),reason:'存在同日打卡、同范围预算或重复首页配置，请核对记录 ID'});}if(key)keys.set(key,record);}
  try{validateRecordGraph(prospective);protectHabitHistory(current,prospective);}catch(error){conflicts.push({reason:error instanceof Error?error.message:'记录关联或历史检查失败'});}
  const removed=mode==='replace'?affected.filter(r=>!incoming.some(n=>n.id===r.id)).length:0;
  const byType=types.map(type=>({type,incoming:incoming.filter(r=>r.type===type).length,current:current.filter(r=>r.type===type).length}));
  return {summary:{added,updated:mode==='replace'?updated:0,removed,unchanged,existingInScope:affected.length,incoming:incoming.length,byType},conflicts:conflicts.slice(0,30),conflictCount:conflicts.length,additions:incoming.filter(r=>!existing.has(r.id)),prospective};
}
function checkedBackup(input:unknown){try{return parseBackup(input);}catch(error){if(error instanceof z.ZodError)throw error;throw new ApiError(400,error instanceof Error?error.message:'备份格式无效','VALIDATION');}}
async function foreignCollision(db:D1Database,owner:string,records:Entity[]){
  for(let i=0;i<records.length;i+=100){const ids=records.slice(i,i+100).map(r=>r.id);if(!ids.length)continue;
    if(await db.prepare(`SELECT 1 AS conflict FROM lifehub_records WHERE owner_id<>? AND id IN (${ids.map(()=>'?').join(',')}) LIMIT 1`).bind(owner,...ids).first())return true;
  }return false;
}
const hashBackup=(backup:ReturnType<typeof checkedBackup>,mode:Mode)=>digest(canonical({scope:backup.scope,records:backup.records,mode}));

export async function exportBackup(request:Request){
  const {user,db}=await authorize(request,true);const {scope}=z.object({scope:z.enum(backupScopeNames)}).strict().parse(await readJson(request));
  const state=await readState(db,user.userId),records=state.records.filter(r=>backupScopes[scope].types.includes(r.type));
  if(records.length>1000)throw new ApiError(413,'此范围超过 1000 条恢复上限，请选择单个模块导出。');
  const body=JSON.stringify({format:'lifehub-backup',version:3,scope,exportedAt:state.serverTime,records},null,2);
  if(new TextEncoder().encode(body).byteLength>1_900_000)throw new ApiError(413,'此备份接近 2 MB 导入上限，请缩小导出范围；没有生成不可恢复的文件。');
  return new Response(body,{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="lifehub-backup-${scope}-${state.serverTime.slice(0,10)}.json"`,'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','X-Record-Count':String(records.length)}});
}
export async function previewBackup(request:Request){
  const {user,db}=await authorize(request,true);const input=z.object({backup:z.unknown(),mode:z.enum(modes)}).strict().parse(await readJson(request));
  const backup=checkedBackup(input.backup),state=await readState(db,user.userId),plan=planBackup(state.records,backup.records,backup.scope,input.mode);
  if(await foreignCollision(db,user.userId,backup.records)){plan.conflicts.push({reason:'部分记录 ID 与受保护记录冲突，不能导入；不会暴露其他数据空间的信息'});plan.conflictCount++;}
  const response={scope:backup.scope,scopeLabel:backupScopes[backup.scope].label,mode:input.mode,summary:plan.summary,conflicts:plan.conflicts,conflictCount:plan.conflictCount,valid:plan.conflictCount===0,spaceId:state.spaceId,serverTime:state.serverTime,warnings:input.mode==='replace'?['将重新保存该范围全部记录并刷新版本；其他模块不受影响。','打卡及规则历史不可丢失，不含完整历史的旧备份会被拒绝。']:['只添加新 ID；相同 ID 且内容一致的记录保留，同 ID 内容冲突会阻止导入。']};
  if(!response.valid)return json(response);
  const id=crypto.randomUUID(),expiresAt=new Date(Date.now()+10*60_000).toISOString();
  await db.batch([
    db.prepare('DELETE FROM lifehub_backup_plans WHERE owner_id=? AND (expires_at<? AND used_at IS NULL OR used_at<?)').bind(user.userId,state.serverTime,new Date(Date.now()-30*86400000).toISOString()),
    db.prepare('INSERT INTO lifehub_backup_plans (id,owner_id,scope,mode,digest,expected_revision,summary,created_at,expires_at,used_at) VALUES (?,?,?,?,?,?,?,?,?,NULL)').bind(id,user.userId,backup.scope,input.mode,await hashBackup(backup,input.mode),Number(state.revision),JSON.stringify(plan.summary),state.serverTime,expiresAt),
  ]);
  return json({...response,planId:id,expiresAt});
}
export async function restore(request:Request){
  const {user,db}=await authorize(request,true);const input=z.object({planId:z.string().uuid(),backup:z.unknown(),confirm:z.literal('RESTORE')}).strict().parse(await readJson(request));
  const preview=await db.prepare('SELECT * FROM lifehub_backup_plans WHERE id=? AND owner_id=?').bind(input.planId,user.userId).first<any>();
  if(!preview)throw new ApiError(404,'找不到当前账户的导入预览，请先生成预览。');
  const backup=checkedBackup(input.backup),mode=preview.mode as Mode;
  if(await hashBackup(backup,mode)!==preview.digest||backup.scope!==preview.scope)throw new ApiError(409,'备份内容或导入范围已改变，请重新预览。');
  async function response(replayed=false){const {records,...state}=await readState(db,user.userId);return json({...state,snapshot:records,summary:JSON.parse(preview.summary),replayed});}
  if(preview.used_at)return response(true);
  const now=new Date().toISOString();if(preview.expires_at<=now)throw new ApiError(410,'预览已超过 10 分钟，请重新预览后确认。');
  const state=await readState(db,user.userId);if(Number(state.revision)!==preview.expected_revision)throw new ApiError(409,'预览后数据已在其他页面或设备变化，尚未导入。请重新预览。');
  const plan=planBackup(state.records,backup.records,backup.scope,mode);if(plan.conflictCount||await foreignCollision(db,user.userId,backup.records))throw new ApiError(409,'记录或关联存在冲突，请重新预览并核对。');
  const types=backupScopes[backup.scope].types,stamp=Date.now(),existing=new Map(state.records.map(r=>[r.id,r]));
  const inserting=mode==='replace'?backup.records:plan.additions;
  const statements:D1PreparedStatement[]=[
    db.prepare('INSERT OR IGNORE INTO lifehub_revisions (owner_id,revision) VALUES (?,0)').bind(user.userId),
    db.prepare('INSERT INTO lifehub_restore_guard (owner_id,valid) SELECT ?,CASE WHEN revision=? THEN 1 ELSE 0 END FROM lifehub_revisions WHERE owner_id=?').bind(user.userId,preview.expected_revision,user.userId),
    db.prepare('UPDATE lifehub_restore_guard SET valid=CASE WHEN EXISTS(SELECT 1 FROM lifehub_backup_plans WHERE id=? AND owner_id=? AND used_at IS NULL AND expires_at>?) THEN 1 ELSE 0 END WHERE owner_id=?').bind(input.planId,user.userId,now,user.userId),
  ];
  if(mode==='replace'){
    const placeholders=types.map(()=>'?').join(',');
    statements.push(db.prepare(`UPDATE lifehub_records SET parent_id=NULL WHERE owner_id=? AND type IN (${placeholders}) AND parent_id IS NOT NULL`).bind(user.userId,...types));
    statements.push(db.prepare(`DELETE FROM lifehub_records WHERE owner_id=? AND type IN (${placeholders})`).bind(user.userId,...types));
  }
  for(const [i,r] of inserting.entries())statements.push(db.prepare('INSERT INTO lifehub_records (id,owner_id,type,data,parent_id,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?)').bind(r.id,user.userId,r.type,JSON.stringify(r.data),parentOf(r.type,r.data)?.id??null,r.createdAt,new Date(Math.max(stamp,Date.parse(r.createdAt),Date.parse(existing.get(r.id)?.updatedAt||'')||0)).toISOString(),Math.max(stamp+i,(existing.get(r.id)?.version||0)+1)));
  if(mode==='replace'&&(backup.scope==='all'||backup.scope==='tasks'))statements.push(db.prepare('UPDATE lifehub_operations SET before_json=NULL,after_json=NULL WHERE owner_id=?').bind(user.userId));
  statements.push(db.prepare('UPDATE lifehub_backup_plans SET used_at=? WHERE id=? AND owner_id=? AND used_at IS NULL').bind(now,input.planId,user.userId),db.prepare('DELETE FROM lifehub_restore_guard WHERE owner_id=?').bind(user.userId));
  await db.batch(statements);return response();
}
