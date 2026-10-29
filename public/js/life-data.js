import {dateKey,addDays} from './date-utils.js';
export const uniqueSessions=records=>[...new Map(records.filter(r=>r.type==='StudySession').map(r=>[r.id,r])).values()];
export const studyMinutes=records=>uniqueSessions(records).reduce((sum,r)=>sum+r.data.minutes,0);
export function learningProgress(records,goal){const sessions=uniqueSessions(records).filter(r=>r.data.goalId===goal.id),minutes=studyMinutes(sessions);return {sessions,minutes,percent:Math.min(100,Math.floor(minutes*100/goal.data.targetMinutes)),stages:goal.data.stages.map(stage=>({...stage,minutes:studyMinutes(sessions.filter(r=>r.data.stageId===stage.id))}))};}
export const habitStart=habit=>habit.data.startedOn||dateKey(habit.createdAt,habit.data.timeZone);
export function habitPlanAt(habit,date){return [...habit.data.scheduleHistory].reverse().find(p=>p.effectiveFrom<=date)||{...habit.data,effectiveFrom:habitStart(habit)};}
export function weekStart(date){return addDays(date,-((new Date(date+'T12:00:00Z').getUTCDay()||7)-1));}
export function monthEnd(month){const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1,0);return d.toISOString().slice(0,10);}
export function dateRange(start,end){const result=[];for(let d=start;d<=end;d=addDays(d,1)){result.push(d);if(result.length>40000)throw new Error('日期范围过长，请按周或月查看');}return result;}
export function habitRecords(records,habit){return records.filter(r=>r.type==='HabitCheckIn'&&r.data.habitId===habit.id);}
export function habitDay(habit,records,date){
  const entry=habitRecords(records,habit).find(r=>r.data.date===date),plan=habitPlanAt(habit,date),weekday=new Date(date+'T12:00:00Z').getUTCDay()||7;
  const scheduled=date>=habitStart(habit)&&plan.weekdays.includes(weekday),status=entry?.data.status||'none';
  return {entry,plan,status,scheduled,eligible:date>=habitStart(habit)&&status!=='rest'&&(scheduled||status==='done')};
}
export function habitPeriod(habit,records,from,to,today){
  if(from>today)return {done:0,target:0,rate:null};
  const start=habitStart(habit),lookup=new Map(habitRecords(records,habit).map(r=>[r.data.date,r]));let target=0,done=0;
  for(const week of [...new Set(dateRange(from,to).map(weekStart))]){
    const days=dateRange(week,addDays(week,6));const anchor=week<start?start:week,plan=habitPlanAt(habit,anchor);
    const eligible=days.filter(d=>d>=start&&habitDay(habit,records,d).eligible),inPeriod=eligible.filter(d=>d>=from&&d<=to);
    const count=inPeriod.filter(d=>d<=today&&lookup.get(d)?.data.status==='done').length;done+=count;
    target+=plan.frequency==='daily'?inPeriod.length:eligible.length?Math.min(plan.weeklyTarget,eligible.length)*inPeriod.length/eligible.length:0;
  }
  return {done,target,rate:target?Math.min(100,Math.round(done*1000/target)/10):null};
}
export function habitStreak(habit,records,today){
  const start=habitStart(habit),lookup=new Map(habitRecords(records,habit).map(r=>[r.data.date,r]));let d=today,count=0;
  // Today's unfinished planned day does not break yesterday's live streak until the day has ended.
  if(lookup.get(d)?.data.status!=='done')d=addDays(d,-1);
  for(;d>=start;d=addDays(d,-1)){
    const day=habitDay(habit,records,d);if(!day.eligible)continue;if(day.status!=='done')break;count++;
  }return count;
}
export function habitStats(habit,records,now=new Date(),month){const today=dateKey(now,habit.data.timeZone),selected=month||today.slice(0,7),start=weekStart(today);return {today,day:habitDay(habit,records,today),streak:habitStreak(habit,records,today),week:habitPeriod(habit,records,start,addDays(start,6),today),month:habitPeriod(habit,records,selected+'-01',monthEnd(selected),today)};}
export function filterBookmarks(records,state){const search=String(state.search||'').trim().toLocaleLowerCase();return records.filter(r=>r.type==='Bookmark'&&(!state.category||r.data.category===state.category)&&(!state.tag||r.data.tags.includes(state.tag))&&(!search||[r.data.title,r.data.url,r.data.note,r.data.category,...r.data.tags].join(' ').toLocaleLowerCase().includes(search))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));}
const csvCell=v=>'"'+(/^[\s\uFEFF]*[=+\-@]/u.test(String(v))?"'":'')+String(v).replaceAll('"','""')+'"';
export function bookmarkExport(records,state,format,now=new Date()){
  const rows=filterBookmarks(records,state);
  if(format==='json')return {body:JSON.stringify({format:'lifehub-bookmarks',version:1,exportedAt:now.toISOString(),filters:state,records:rows},null,2),mime:'application/json',count:rows.length};
  return {body:'\uFEFF'+[['标题','URL','分类','标签','个人笔记','创建时间','更新时间'].map(csvCell).join(','),...rows.map(r=>[r.data.title,r.data.url,r.data.category,r.data.tags.join('；'),r.data.note,r.createdAt,r.updatedAt].map(csvCell).join(','))].join('\r\n')+'\r\n',mime:'text/csv; charset=utf-8',count:rows.length};
}
