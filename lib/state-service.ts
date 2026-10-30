import {toEntity,normalizeHabitStarts,stateKey} from './record-utils';
import {spaceFor} from './auth-service';
export async function readState(db:D1Database,owner:string){
  // All reads share one D1 batch transaction, avoiding a revision from a different snapshot.
  const [revisions,rows,operations]=await db.batch([
    db.prepare('SELECT revision FROM lifehub_revisions WHERE owner_id=?').bind(owner),
    db.prepare('SELECT * FROM lifehub_records WHERE owner_id=? ORDER BY created_at DESC,id').bind(owner),
    db.prepare('SELECT id,label,created_at,before_json,undone FROM lifehub_operations WHERE owner_id=? ORDER BY ordinal DESC LIMIT 1').bind(owner),
  ]);
  const raw=rows.results as any[],preference=raw.find(r=>r.type==='DashboardPreference'),zone=preference?JSON.parse(preference.data).timeZone:'Asia/Shanghai';
  const records=normalizeHabitStarts(raw.map(r=>toEntity(r,zone))),operation=operations.results[0] as any;
  return {records,stateKey:stateKey(records),revision:String((revisions.results[0] as any)?.revision??0),spaceId:await spaceFor(owner),undo:operation&&!operation.undone&&operation.before_json!==null?{id:operation.id,label:operation.label,createdAt:operation.created_at}:null,serverTime:new Date().toISOString()};
}
export async function mutationState(db:D1Database,owner:string,result:any){
  const {records,...state}=await readState(db,owner);return {...result,...state,snapshot:records,record:records.find(r=>r.id===result.record?.id)};
}
