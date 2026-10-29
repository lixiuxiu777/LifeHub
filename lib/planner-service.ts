import {z} from 'zod';
import {ApiError} from './api-error';
import {parseData,parentOf,relationOrder,type Entity,type EntityType} from './domain';
import {snapshot} from './record-utils';
import {repeatDates} from '../public/js/planner-data.js';

type Input={id?:string;type:EntityType;version?:number;data?:unknown;operationId?:string};
type Plan={before:Entity[];after:Entity[];label:string;resultId:string};
const isPlanner=(r:Entity)=>r.type==='Task'||r.type==='CalendarEvent';
async function revision(db:D1Database,owner:string){return (await db.prepare('SELECT revision FROM lifehub_revisions WHERE owner_id=?').bind(owner).first<{revision:number}>())?.revision??0;}
function guards(db:D1Database,owner:string,rev:number){return [
  db.prepare('INSERT OR IGNORE INTO lifehub_revisions (owner_id,revision) VALUES (?,0)').bind(owner),
  db.prepare('INSERT INTO lifehub_restore_guard (owner_id,valid) SELECT ?,CASE WHEN revision=? THEN 1 ELSE 0 END FROM lifehub_revisions WHERE owner_id=?').bind(owner,rev,owner),
];}
function finish(db:D1Database,owner:string){return db.prepare('DELETE FROM lifehub_restore_guard WHERE owner_id=?').bind(owner);}
function fresh(type:EntityType,data:any,previous?:Entity,id=crypto.randomUUID()):Entity{
  const now=new Date(Math.max(Date.now(),Date.parse(previous?.createdAt||'')||0)).toISOString();
  return {id:previous?.id??id,type,data,createdAt:previous?.createdAt??now,updatedAt:now,version:Math.max(Date.now(),(previous?.version||0)+1)};
}
export async function undoInfo(db:D1Database,owner:string){
  const row=await db.prepare('SELECT id,label,created_at,before_json,after_json,undone FROM lifehub_operations WHERE owner_id=? ORDER BY ordinal DESC LIMIT 1').bind(owner).first<any>();
  return row&&!row.undone&&row.before_json!==null?{id:row.id,label:row.label,createdAt:row.created_at}:null;
}
function validateGraph(records:Entity[]){
  try{relationOrder(records);}catch(error){throw new ApiError(400,error instanceof Error?error.message:'关联无效');}
  const map=new Map(records.map(r=>[r.id,r]));
  for(const r of records){if(r.type!=='Task')continue;const d=r.data as any;
    let current:Entity|undefined=r;let depth=0;const visited=new Set<string>();
    while(current){if(visited.has(current.id))throw new ApiError(400,'子任务不能关联自身或形成循环');visited.add(current.id);const parent=(current.data as any).parentTaskId;if(!parent)break;if(++depth>4)throw new ApiError(400,'子任务最多支持 5 层');current=map.get(parent);}
    if(d.parentTaskId&&d.recurrence)throw new ApiError(400,'重复任务需要建立为顶层任务，可为每个实例分别添加子任务');
  }
}
function prospective(current:Entity[],before:Entity[],after:Entity[]){const ids=new Set(before.map(r=>r.id));return current.filter(r=>!ids.has(r.id)).concat(after);}
function planFor(method:string,input:Input,data:any,current:Entity[]):Plan{
  const existing=current.find(r=>r.id===input.id&&r.type===input.type);
  if(method!=='POST'){
    if(!input.id||!input.version)throw new ApiError(400,'缺少记录 ID 或版本');
    if(!existing)throw new ApiError(404,'记录不存在或无法访问');
    if(existing.version!==input.version)throw new ApiError(409,'事项已在其他位置修改，请刷新后重试');
  }else if(input.id||input.version)throw new ApiError(400,'新增记录由服务器分配 ID');
  if(method==='DELETE'){
    const before=[existing!],after:Entity[]=[];
    if(input.type==='Task')for(const r of current){const d=r.data as any;
      if(r.type==='Task'&&d.parentTaskId===existing!.id){before.push(r);after.push(fresh(r.type,{...d,parentTaskId:null},r));}
      if(r.type==='CalendarEvent'&&d.taskId===existing!.id){before.push(r);after.push(fresh(r.type,{...d,taskId:null},r));}
    }
    return {before,after,label:input.type==='Task'?'删除待办任务':'删除日程',resultId:existing!.id};
  }
  const before=existing?[existing]:[];let after:Entity[]=[];
  if(input.type==='Task'){
    const old=existing?.data as any;
    if(old?.seriesId){
      if(data.seriesId!==old.seriesId||data.occurrenceDate!==old.occurrenceDate||data.occurrenceIndex!==old.occurrenceIndex||JSON.stringify(data.recurrence)!==JSON.stringify(old.recurrence))throw new ApiError(400,'重复规则和实例身份不能在单条编辑中修改；请新建重复计划');
    }else if(data.seriesId||data.occurrenceDate||data.occurrenceIndex)throw new ApiError(400,'重复实例身份由服务器生成');
    if(data.recurrence&&!old?.seriesId){
      if(data.parentTaskId)throw new ApiError(400,'重复任务必须为顶层任务');
      let dates:string[];try{dates=repeatDates(data.dueDate,data.recurrence);}catch(error){throw new ApiError(400,error instanceof Error?error.message:'重复日期无效');}
      const seriesId=crypto.randomUUID();after=dates.map((dueDate,index)=>fresh('Task',{...data,dueDate,status:index===0?data.status:'todo',seriesId,occurrenceDate:dueDate,occurrenceIndex:index+1},index===0?existing:undefined));
    }else after=[fresh('Task',data,existing)];
  }else after=[fresh('CalendarEvent',data,existing)];
  validateGraph(prospective(current,before,after));
  return {before,after,label:after.length>1?`生成重复任务 · ${after.length} 个实例`:`${method==='POST'?'新增':'编辑'}${input.type==='Task'?'待办任务':'日程'}`,resultId:after[0].id};
}
function statements(db:D1Database,owner:string,before:Entity[],after:Entity[]){
  const old=new Map(before.map(r=>[r.id,r])),next=new Map(after.map(r=>[r.id,r]));
  // New parents first, then detach/reparent existing rows, then child-first deletions.
  const insert=after.filter(r=>!old.has(r.id));
  const ordered:Entity[]=[];const pending=[...insert];
  while(pending.length){const index=pending.findIndex(r=>!pending.some(p=>p.id===parentOf(r.type,r.data)?.id));if(index<0)throw new ApiError(400,'关联存在循环');ordered.push(...pending.splice(index,1));}
  const deleting=before.filter(r=>!next.has(r.id));const deletes:Entity[]=[];
  while(deleting.length){const index=deleting.findIndex(r=>!deleting.some(child=>parentOf(child.type,child.data)?.id===r.id));if(index<0)throw new ApiError(400,'关联存在循环');deletes.push(...deleting.splice(index,1));}
  return [
    ...ordered.map(r=>db.prepare('INSERT INTO lifehub_records (id,owner_id,type,data,parent_id,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?)').bind(r.id,owner,r.type,JSON.stringify(r.data),parentOf(r.type,r.data)?.id??null,r.createdAt,r.updatedAt,r.version)),
    ...after.filter(r=>old.has(r.id)).map(r=>db.prepare('UPDATE lifehub_records SET data=?,parent_id=?,updated_at=?,version=? WHERE id=? AND owner_id=? AND version=?').bind(JSON.stringify(r.data),parentOf(r.type,r.data)?.id??null,r.updatedAt,r.version,r.id,owner,old.get(r.id)!.version)),
    ...deletes.map(r=>db.prepare('DELETE FROM lifehub_records WHERE id=? AND owner_id=? AND version=?').bind(r.id,owner,r.version)),
  ];
}
async function response(db:D1Database,owner:string,resultId?:string,extra:any={}){
  const records=await snapshot(db,owner);return {snapshot:records,record:records.find(r=>r.id===resultId),undo:await undoInfo(db,owner),...extra};
}
export async function plannerMutation(db:D1Database,owner:string,input:Input,method:string){
  const data=method==='DELETE'?undefined:parseData(input.type,input.data);
  const operationId=input.operationId??crypto.randomUUID();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({method,type:input.type,id:input.id,version:input.version,data}))))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const receipt=await db.prepare('SELECT digest,result_id FROM lifehub_operations WHERE id=? AND owner_id=?').bind(operationId,owner).first<any>();
  if(receipt){if(receipt.digest!==digest)throw new ApiError(409,'操作编号已使用，请刷新后重新操作');return response(db,owner,receipt.result_id,{replayed:true});}
  const rev=await revision(db,owner);const current=await snapshot(db,owner);const plan=planFor(method,input,data,current);
  const ordinal=((await db.prepare('SELECT MAX(ordinal) AS ordinal FROM lifehub_operations WHERE owner_id=?').bind(owner).first<{ordinal:number|null}>())?.ordinal??0)+1;
  if(plan.before.length+plan.after.length>250||new TextEncoder().encode(JSON.stringify(plan)).byteLength>700000)throw new ApiError(413,'本次关联事项过多，请分批处理');
  await db.batch([
    ...guards(db,owner,rev),...statements(db,owner,plan.before,plan.after),
    db.prepare('UPDATE lifehub_operations SET before_json=NULL,after_json=NULL WHERE owner_id=?').bind(owner),
    db.prepare('INSERT INTO lifehub_operations (id,owner_id,digest,label,before_json,after_json,result_id,created_at,ordinal,undone) VALUES (?,?,?,?,?,?,?,?,?,0)').bind(operationId,owner,digest,plan.label,JSON.stringify(plan.before),JSON.stringify(plan.after),plan.resultId,new Date().toISOString(),ordinal),
    finish(db,owner),
  ]);
  return response(db,owner,plan.resultId,{deleted:method==='DELETE'?plan.resultId:undefined,affected:plan.after.map(r=>r.id)});
}
export async function undoOperation(db:D1Database,owner:string,operationId:unknown){
  const id=z.string().uuid().parse(operationId);const latest=await db.prepare('SELECT * FROM lifehub_operations WHERE owner_id=? ORDER BY ordinal DESC LIMIT 1').bind(owner).first<any>();
  if(!latest||latest.id!==id)throw new ApiError(409,'最近操作已变化，请刷新后再选择撤销');
  if(latest.undone)return response(db,owner,undefined,{replayed:true});
  if(latest.before_json===null)throw new ApiError(409,'此操作的撤销已失效');
  const before=JSON.parse(latest.before_json) as Entity[],after=JSON.parse(latest.after_json) as Entity[];
  const rev=await revision(db,owner),current=await snapshot(db,owner),map=new Map(current.map(r=>[r.id,r]));
  for(const r of after)if(map.get(r.id)?.version!==r.version)throw new ApiError(409,'相关事项已修改，无法安全撤销');
  for(const r of before)if(!after.some(a=>a.id===r.id)&&map.has(r.id))throw new ApiError(409,'记录 ID 已被使用，无法安全撤销');
  const restored=before.map(r=>fresh(r.type,r.data,{...r,version:Math.max(r.version,map.get(r.id)?.version||0)}));
  validateGraph(prospective(current,after,restored));
  await db.batch([...guards(db,owner,rev),db.prepare('UPDATE lifehub_restore_guard SET valid=CASE WHEN (SELECT id FROM lifehub_operations WHERE owner_id=? ORDER BY ordinal DESC LIMIT 1)=? THEN 1 ELSE 0 END WHERE owner_id=?').bind(owner,id,owner),...statements(db,owner,after,restored),db.prepare('UPDATE lifehub_operations SET before_json=NULL,after_json=NULL,undone=1 WHERE id=? AND owner_id=?').bind(id,owner),finish(db,owner)]);
  return response(db,owner,undefined,{undone:true});
}
