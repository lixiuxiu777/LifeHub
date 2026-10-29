export function dateKey(value,timeZone='Asia/Shanghai'){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const pick=key=>parts.find(p=>p.type===key).value;return `${pick('year')}-${pick('month')}-${pick('day')}`;
}
export function addDays(key,count){const d=new Date(`${key}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10);}
export function dashboard(records,preferences,now=new Date()){
  const list=type=>records.filter(r=>r.type===type);const today=dateKey(now,preferences.timeZone);const month=today.slice(0,7);
  const tasks=list('Task').filter(r=>r.data.dueDate===today).sort((a,b)=>Number(a.data.status==='done')-Number(b.data.status==='done')||Number(b.data.priority==='high')-Number(a.data.priority==='high'));
  // Includes ongoing events crossing midnight, and starts in the next seven calendar days.
  const schedule=list('CalendarEvent').filter(r=>dateKey(r.data.endAt,preferences.timeZone)>=today&&dateKey(r.data.startAt,preferences.timeZone)<addDays(today,7)).sort((a,b)=>Date.parse(a.data.startAt)-Date.parse(b.data.startAt));
  const expenses=list('Expense').filter(r=>r.data.date.slice(0,7)===month);
  const totals={};for(const r of expenses)totals[r.data.currency]=(totals[r.data.currency]||0n)+BigInt(r.data.amountMinor);
  const budgets=list('Budget').filter(r=>r.data.month===month);
  const sessions=list('StudySession');const goals=list('LearningGoal');
  const learning=goals.map(goal=>({...goal,minutes:sessions.filter(s=>s.data.goalId===goal.id).reduce((sum,s)=>sum+s.data.minutes,0)}));
  const habits=list('Habit');const checkins=list('HabitCheckIn');
  const weekDay=new Date(`${today}T12:00:00Z`).getUTCDay();const weekStart=addDays(today,-((weekDay+6)%7));
  const habitDays=new Set(checkins.filter(r=>r.data.date>=weekStart&&r.data.date<=today).map(r=>r.data.date)).size;
  return {today,month,tasks,schedule,expenses,totals,budgets,learning,sessions,habits,checkins,habitDays,bookmarks:list('Bookmark').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),pendingTasks:tasks.filter(r=>r.data.status==='todo').length,activeGoals:goals.filter(r=>r.data.status==='active').length,studyMinutes:sessions.filter(s=>s.data.date.slice(0,7)===month).reduce((sum,s)=>sum+s.data.minutes,0)};
}
