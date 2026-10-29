import {parseData,type Entity} from './domain';
import {dateKey} from '../public/js/date-utils.js';
export function toEntity(row:any,fallbackZone='Asia/Shanghai'):Entity{
  let data=JSON.parse(row.data);if(['Task','Habit'].includes(row.type)&&data&&typeof data==='object'&&!Object.hasOwn(data,'timeZone'))data={...data,timeZone:fallbackZone};
  return {id:row.id,type:row.type,data:parseData(row.type,data),createdAt:row.created_at,updatedAt:row.updated_at,version:row.version};
}
export async function snapshot(db:D1Database,owner:string){
  const rows=await db.prepare('SELECT * FROM lifehub_records WHERE owner_id=? ORDER BY created_at DESC,id').bind(owner).all();
  const preference=rows.results.find((r:any)=>r.type==='DashboardPreference') as any;
  const zone=preference?JSON.parse(preference.data).timeZone:'Asia/Shanghai';return normalizeHabitStarts(rows.results.map(r=>toEntity(r,zone)));
}
export function normalizeHabitStarts(records:Entity[]):Entity[]{return records.map(r=>{if(r.type!=='Habit'||(r.data as any).startedOn)return r;const data=r.data as any;const start=[dateKey(r.createdAt,data.timeZone),...records.filter(c=>c.type==='HabitCheckIn'&&(c.data as any).habitId===r.id).map(c=>(c.data as any).date)].sort()[0];return {...r,data:{...data,startedOn:start}};});}
export function stateKey(records:Entity[]){return records.map(r=>`${r.id}:${r.version}`).sort().join('|');}
