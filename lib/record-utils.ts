import {parseData,type Entity} from './domain';
export function toEntity(row:any,fallbackZone='Asia/Shanghai'):Entity{
  let data=JSON.parse(row.data);if(row.type==='Task'&&data&&typeof data==='object'&&!Object.hasOwn(data,'timeZone'))data={...data,timeZone:fallbackZone};
  return {id:row.id,type:row.type,data:parseData(row.type,data),createdAt:row.created_at,updatedAt:row.updated_at,version:row.version};
}
export async function snapshot(db:D1Database,owner:string){
  const rows=await db.prepare('SELECT * FROM lifehub_records WHERE owner_id=? ORDER BY created_at DESC,id').bind(owner).all();
  const preference=rows.results.find((r:any)=>r.type==='DashboardPreference') as any;
  const zone=preference?JSON.parse(preference.data).timeZone:'Asia/Shanghai';return rows.results.map(r=>toEntity(r,zone));
}
export function stateKey(records:Entity[]){return records.map(r=>`${r.id}:${r.version}`).sort().join('|');}
