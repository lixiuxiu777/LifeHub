import {ApiError} from './api-error';
import {parseData,parentOf,type EntityType} from './domain';
import {snapshot} from './record-utils';
import {dateKey,addDays} from '../public/js/date-utils.js';
import {undoInfo} from './planner-service';
type Input={id?:string;type:EntityType;version?:number;data?:unknown;operationId?:string};
export async function lifeMutation(db:D1Database,owner:string,input:Input,method:string){
  if(input.type==='DashboardPreference'&&method==='DELETE')throw new ApiError(400,'请通过恢复默认布局重置配置');
  const operationId=input.operationId??crypto.randomUUID();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({method,type:input.type,id:input.id,version:input.version,data:input.data}))))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const receipt=await db.prepare('SELECT digest,result_id FROM lifehub_life_receipts WHERE id=? AND owner_id=?').bind(operationId,owner).first<any>();
  async function result(id:string,replayed=false){const records=await snapshot(db,owner);return {snapshot:records,record:records.find(r=>r.id===id),undo:await undoInfo(db,owner),replayed};}
  if(receipt){if(receipt.digest!==digest)throw new ApiError(409,'操作编号已使用，请关闭表单并刷新后重新操作');return result(receipt.result_id,true);}
  const rev=(await db.prepare('SELECT revision FROM lifehub_revisions WHERE owner_id=?').bind(owner).first<{revision:number}>())?.revision??0;
  const current=await snapshot(db,owner),previous=current.find(r=>r.id===input.id&&r.type===input.type);const old=previous?.data as any;
  if(method==='POST'){if(input.id||input.version)throw new ApiError(400,'新增记录由服务器分配 ID');}
  else{if(!input.id||!input.version)throw new ApiError(400,'缺少 ID 或版本');if(!previous)throw new ApiError(404,'记录不存在或无法访问');if(previous.version!==input.version)throw new ApiError(409,'记录已在其他位置修改，请刷新后重试');}
  const isVoid=method==='DELETE'&&input.type==='HabitCheckIn',deleting=method==='DELETE'&&!isVoid;
  if(deleting&&input.type==='Habit'&&current.some(r=>r.type==='HabitCheckIn'&&(r.data as any).habitId===input.id))throw new ApiError(409,'此习惯已有打卡历史，请归档习惯以保留历史');
  if(deleting&&input.type==='LearningGoal'&&current.some(r=>r.type==='StudySession'&&(r.data as any).goalId===input.id))throw new ApiError(409,'此目标已有学习记录，请保留目标或先将学习记录改为独立学习');
  let data:any=deleting?undefined:parseData(input.type,isVoid?{habitId:old.habitId,date:old.date,note:old.note,status:'void'}:input.data);
  const raw=input.data as any;
  const zone=(current.find(r=>r.type==='DashboardPreference')?.data as any)?.timeZone||'Asia/Shanghai';
  if(!deleting&&input.type==='LearningGoal'&&previous){
    const used=current.filter(r=>r.type==='StudySession'&&(r.data as any).goalId===input.id).map(r=>(r.data as any).stageId).filter(Boolean);
    if(used.some(id=>!data.stages.some((s:any)=>s.id===id)))throw new ApiError(409,'已有学习记录的阶段不能移除，请先调整这些记录的阶段归属');
  }
  if(!deleting&&input.type==='StudySession'){
    if(data.date>dateKey(new Date(),zone))throw new ApiError(400,'学习记录不能填写未来日期');
    if(current.filter(r=>r.type==='StudySession'&&r.id!==input.id&&(r.data as any).date===data.date).reduce((n,r)=>n+(r.data as any).minutes,0)+data.minutes>1440)throw new ApiError(400,'同一天学习记录合计不能超过 1440 分钟');
    if(data.stageId){const goal=current.find(r=>r.id===data.goalId&&r.type==='LearningGoal');if(!(goal?.data as any)?.stages.some((s:any)=>s.id===data.stageId))throw new ApiError(400,'所选阶段不属于此学习目标');}
  }
  if(!deleting&&input.type==='Habit'){
    const today=dateKey(new Date(),data.timeZone);data.startedOn??=previous?dateKey(previous.createdAt,data.timeZone):today;
    if(data.startedOn>today)throw new ApiError(400,'习惯开始日期不能晚于今天');
    if(raw?.scheduleHistory&&JSON.stringify(raw.scheduleHistory)!==JSON.stringify(old?.scheduleHistory||[]))throw new ApiError(400,'历史规则由服务器维护');
    const hasHistory=current.some(r=>r.type==='HabitCheckIn'&&(r.data as any).habitId===input.id);
    if(hasHistory&&(data.startedOn!==(old.startedOn||dateKey(previous!.createdAt,old.timeZone))||data.timeZone!==old.timeZone))throw new ApiError(409,'已有打卡时不能改变开始日期或时区，以免重写历史');
    const plan=(d:any,effectiveFrom:string)=>({effectiveFrom,frequency:d.frequency,weeklyTarget:d.weeklyTarget,weekdays:d.weekdays});
    if(!hasHistory)data.scheduleHistory=[plan(data,data.startedOn)];
    else{
      data.scheduleHistory=old.scheduleHistory.length?[...old.scheduleHistory]:[plan(old,old.startedOn||dateKey(previous!.createdAt,old.timeZone))];
      if(data.frequency!==old.frequency||data.weeklyTarget!==old.weeklyTarget||JSON.stringify(data.weekdays)!==JSON.stringify(old.weekdays)){
        const weekday=new Date(today+'T12:00:00Z').getUTCDay()||7,effectiveFrom=addDays(today,8-weekday);
        data.scheduleHistory=data.scheduleHistory.filter((v:any)=>v.effectiveFrom!==effectiveFrom).concat(plan(data,effectiveFrom));
      }
    }
    data=parseData('Habit',data);
  }
  if(!deleting&&input.type==='HabitCheckIn'){
    const habit=current.find(r=>r.type==='Habit'&&r.id===data.habitId);if(!habit)throw new ApiError(400,'习惯不存在或无法访问');const h=habit.data as any;
    if(previous&&(data.habitId!==old.habitId||data.date!==old.date))throw new ApiError(400,'打卡所属习惯和日期不可修改，请撤销原记录后补记');
    if(!previous&&h.archived)throw new ApiError(400,'请先恢复已归档习惯');
    if(data.date>dateKey(new Date(),h.timeZone)||data.date<(h.startedOn||dateKey(habit.createdAt,h.timeZone)))throw new ApiError(400,'打卡日期应在习惯开始日至今天之间');
    if(raw?.history&&JSON.stringify(raw.history)!==JSON.stringify(old?.history||[]))throw new ApiError(400,'打卡变更历史由服务器维护');
    if(!previous&&current.some(r=>r.type==='HabitCheckIn'&&(r.data as any).habitId===data.habitId&&(r.data as any).date===data.date))throw new ApiError(409,'当天已有记录（含撤销记录），请从日历打开原记录修改');
    const history=old?.history.length?[...old.history]:previous?[{at:previous.updatedAt,status:old.status,note:old.note}]:[];
    if(!previous||old.status!==data.status||old.note!==data.note)history.push({at:new Date(Math.max(Date.now(),Date.parse(history.at(-1)?.at||'')||0)).toISOString(),status:data.status,note:data.note});
    if(history.length>5000)throw new ApiError(413,'该日变更历史已达上限，原记录及历史完整保留');
    data=parseData('HabitCheckIn',{...data,history});
  }
  const parent=deleting?null:parentOf(input.type,data);
  if(parent&&!current.some(r=>r.id===parent.id&&r.type===parent.type))throw new ApiError(400,'关联记录不存在或无法访问');
  const now=new Date(Math.max(Date.now(),Date.parse(previous?.updatedAt||'')||0)).toISOString(),id=previous?.id??crypto.randomUUID(),version=Math.max(Date.now(),(previous?.version||0)+1);
  const write=deleting?db.prepare('DELETE FROM lifehub_records WHERE id=? AND owner_id=? AND version=?').bind(id,owner,input.version):method==='POST'?db.prepare('INSERT INTO lifehub_records (id,owner_id,type,data,parent_id,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?)').bind(id,owner,input.type,JSON.stringify(data),parent?.id??null,now,now,version):db.prepare('UPDATE lifehub_records SET data=?,parent_id=?,updated_at=?,version=? WHERE id=? AND owner_id=? AND version=?').bind(JSON.stringify(data),parent?.id??null,now,version,id,owner,input.version);
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO lifehub_revisions (owner_id,revision) VALUES (?,0)').bind(owner),
    db.prepare('INSERT INTO lifehub_restore_guard (owner_id,valid) SELECT ?,CASE WHEN revision=? THEN 1 ELSE 0 END FROM lifehub_revisions WHERE owner_id=?').bind(owner,rev,owner),write,
    db.prepare('INSERT INTO lifehub_life_receipts (id,owner_id,digest,result_id,created_at) VALUES (?,?,?,?,?)').bind(operationId,owner,digest,id,now),
    db.prepare('DELETE FROM lifehub_restore_guard WHERE owner_id=?').bind(owner),
  ]);return result(id);
}

export function protectHabitHistory(current:any[],incoming:any[]){
  for(const record of current.filter(r=>r.type==='HabitCheckIn')){
    const next=incoming.find(r=>r.id===record.id&&r.type==='HabitCheckIn'),a=record.data,b=next?.data;
    if(!b||b.habitId!==a.habitId||b.date!==a.date||b.history.length<a.history.length||JSON.stringify(b.history.slice(0,a.history.length))!==JSON.stringify(a.history)||!a.history.length&&(b.status!==a.status||b.note!==a.note))throw new ApiError(409,'备份会丢失现有打卡或变更历史，恢复已取消；请使用包含完整历史的最新备份');
  }
  for(const record of current.filter(r=>r.type==='Habit'&&current.some(c=>c.type==='HabitCheckIn'&&c.data.habitId===r.id))){const next=incoming.find(r=>r.id===record.id&&r.type==='Habit'),d=record.data,n=next?.data;if(!n||n.timeZone!==d.timeZone||n.startedOn!==d.startedOn||JSON.stringify(n.scheduleHistory)!==JSON.stringify(d.scheduleHistory)||!d.scheduleHistory.length&&(n.frequency!==d.frequency||n.weeklyTarget!==d.weeklyTarget||JSON.stringify(n.weekdays)!==JSON.stringify(d.weekdays)))throw new ApiError(409,'备份会改写习惯历史规则，恢复已取消');}
}
