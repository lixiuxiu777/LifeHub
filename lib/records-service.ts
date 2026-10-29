import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { entityTypes,parseData,parentOf,validateBackup,type Entity } from './domain';
import {ApiError} from './api-error';
import {snapshot,stateKey} from './record-utils';
import {plannerMutation} from './planner-service';
import {financeMutation} from './finance-service';
import {lifeMutation,protectHabitHistory} from './life-service';
export {ApiError,snapshot,stateKey};

export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'}});
export async function authorize(request:Request,write=false){
  const user=await getChatGPTUser();if(!user)throw new ApiError(401,'请先登录 ChatGPT，再访问个人记录。');
  if(write){
    if(request.headers.get('origin')!==new URL(request.url).origin)throw new ApiError(403,'请求来源无效，请从本站操作。');
    if(!request.headers.get('content-type')?.includes('application/json'))throw new ApiError(415,'需要 JSON 请求。');
  }
  if(!env.DB)throw new ApiError(503,'数据库暂不可用，请稍后重试。');
  return {user,db:env.DB};
}
export async function readJson(request:Request){
  if(Number(request.headers.get('content-length')||0)>2_000_000)throw new ApiError(413,'数据超过 2 MB 限制。');
  const text=await request.text();if(text.length>2_000_000)throw new ApiError(413,'数据超过 2 MB 限制。');
  try{return JSON.parse(text);}catch{throw new ApiError(400,'JSON 格式无效。');}
}
const mutation=z.object({id:z.string().uuid().optional(),type:z.enum(entityTypes),version:z.number().int().positive().safe().optional(),data:z.unknown().optional(),operationId:z.string().uuid().optional()}).strict();
export async function mutate(request:Request,method:string){
  const {user,db}=await authorize(request,true);const input=mutation.parse(await readJson(request));let previous:any=null;
  if(input.type==='Task'||input.type==='CalendarEvent')return json(await plannerMutation(db,user.userId,input,method),method==='POST'?201:200);
  if(input.type==='Expense'||input.type==='Budget')return json(await financeMutation(db,user.userId,input,method),method==='POST'?201:200);
  if(['LearningGoal','StudySession','Habit','HabitCheckIn','Bookmark'].includes(input.type))return json(await lifeMutation(db,user.userId,input,method),method==='POST'?201:200);
  if(method!=='POST'){
    if(!input.id||!input.version)throw new ApiError(400,'缺少记录 ID 或版本。');
    previous=await db.prepare('SELECT * FROM lifehub_records WHERE id = ? AND owner_id = ? AND type = ?').bind(input.id,user.userId,input.type).first();
    if(!previous)throw new ApiError(404,'记录不存在或无法访问。');
    if(previous.version!==input.version)throw new ApiError(409,'另一处已修改这条记录，请刷新后重试。');
  }else if(input.id||input.version)throw new ApiError(400,'新增记录由服务器分配 ID 和版本。');
  if(method==='DELETE'){
    if(input.type==='DashboardPreference')throw new ApiError(400,'请通过恢复默认布局重置配置。');
    const result=await db.prepare('DELETE FROM lifehub_records WHERE id=? AND owner_id=? AND version=?').bind(input.id,user.userId,input.version).run();
    if(result.meta.changes===0)throw new ApiError(409,'记录已变化，请刷新后重试。');return json({deleted:input.id});
  }
  const data=parseData(input.type,input.data);const parent=parentOf(input.type,data);
  if(parent){const exists=await db.prepare('SELECT id FROM lifehub_records WHERE id=? AND owner_id=? AND type=?').bind(parent.id,user.userId,parent.type).first();if(!exists)throw new ApiError(400,'关联记录不存在，请先建立习惯或学习目标。');}
  const now=new Date(Math.max(Date.now(),Date.parse(previous?.created_at||'')||0)).toISOString();const record:Entity={id:previous?.id??crypto.randomUUID(),type:input.type,data,createdAt:previous?.created_at??now,updatedAt:now,version:previous?Math.max(Date.now(),previous.version+1):Date.now()};
  if(method==='POST')await db.prepare('INSERT INTO lifehub_records (id,owner_id,type,data,parent_id,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?)').bind(record.id,user.userId,record.type,JSON.stringify(data),parent?.id??null,record.createdAt,now,record.version).run();
  else{const result=await db.prepare('UPDATE lifehub_records SET data=?,parent_id=?,updated_at=?,version=? WHERE id=? AND owner_id=? AND version=?').bind(JSON.stringify(data),parent?.id??null,now,record.version,record.id,user.userId,input.version).run();if(result.meta.changes===0)throw new ApiError(409,'记录已变化，请刷新后重试。');}
  return json({record},method==='POST'?201:200);
}
export async function restore(request:Request){
  const {user,db}=await authorize(request,true);let records:Entity[];
  const input=z.object({backup:z.unknown(),expectedState:z.string(),confirm:z.literal('RESTORE')}).strict().parse(await readJson(request));
  try{records=validateBackup(input.backup);}catch(error){if(error instanceof z.ZodError)throw error;throw new ApiError(400,error instanceof Error?error.message:'备份无效');}
  // Read revision BEFORE snapshot; the transactional guard catches all later concurrent writes.
  const revision=await db.prepare('SELECT revision FROM lifehub_revisions WHERE owner_id=?').bind(user.userId).first<{revision:number}>();
  const current=await snapshot(db,user.userId);if(stateKey(current)!==input.expectedState)throw new ApiError(409,'备份预览后记录已变化，请重新预览再恢复。');
  protectHabitHistory(current,records);
  const stamp=Date.now();await db.batch([
    db.prepare('INSERT OR IGNORE INTO lifehub_revisions (owner_id,revision) VALUES (?,0)').bind(user.userId),
    db.prepare('INSERT INTO lifehub_restore_guard (owner_id,valid) SELECT ?,CASE WHEN revision=? THEN 1 ELSE 0 END FROM lifehub_revisions WHERE owner_id=?').bind(user.userId,revision?.revision??0,user.userId),
    db.prepare('UPDATE lifehub_records SET parent_id=NULL WHERE owner_id=? AND parent_id IS NOT NULL').bind(user.userId),
    db.prepare('DELETE FROM lifehub_records WHERE owner_id=?').bind(user.userId),
    ...records.map((r,i)=>db.prepare('INSERT INTO lifehub_records (id,owner_id,type,data,parent_id,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?)').bind(r.id,user.userId,r.type,JSON.stringify(r.data),parentOf(r.type,r.data)?.id??null,r.createdAt,new Date(Math.max(stamp,Date.parse(r.createdAt))).toISOString(),stamp+i)),
    db.prepare('UPDATE lifehub_operations SET before_json=NULL,after_json=NULL WHERE owner_id=?').bind(user.userId),
    db.prepare('DELETE FROM lifehub_restore_guard WHERE owner_id=?').bind(user.userId),
  ]);return json({restored:records.length});
}
export async function safely(action:()=>Promise<Response>){
  try{return await action();}catch(error){
    if(error instanceof ApiError)return json({message:error.message},error.status);
    if(error instanceof z.ZodError)return json({message:error.issues.map(v=>v.message).slice(0,3).join('；')},400);
    if(/UNIQUE|FOREIGN KEY|CHECK constraint/i.test(error instanceof Error?error.message:''))return json({message:'数据已变化或存在关联冲突。此次操作未生效，请刷新核对后重试。'},409);
    return json({message:'服务暂时不可用，尚未确认保存，请刷新核对后重试。'},503);
  }
}
