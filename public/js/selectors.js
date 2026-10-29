import { dateKey,addDays } from './date-utils.js';
import { isTaskToday,upcomingEvents } from './planner-data.js';
import {uniqueSessions,habitStats} from './life-data.js';
export {dateKey,addDays};
export function dashboard(records,preferences,now=new Date()){
  const list=type=>records.filter(r=>r.type===type);const today=dateKey(now,preferences.timeZone);const month=today.slice(0,7);
  const tasks=list('Task').filter(r=>r.data.status!=='done'&&isTaskToday(r,now)).sort((a,b)=>['urgent','high','normal','low'].indexOf(a.data.priority)-['urgent','high','normal','low'].indexOf(b.data.priority));
  // Includes ongoing events crossing midnight, and starts in the next seven calendar days.
  const schedule=upcomingEvents(list('CalendarEvent'),preferences.timeZone,now);
  const expenses=list('Expense').filter(r=>r.data.date.slice(0,7)===month&&r.data.direction!=='income');
  const totals={};for(const r of expenses)totals[r.data.currency]=(totals[r.data.currency]||0n)+BigInt(r.data.amountMinor);
  const incomes=list('Expense').filter(r=>r.data.date.slice(0,7)===month&&r.data.direction==='income'),incomeTotals={};for(const r of incomes)incomeTotals[r.data.currency]=(incomeTotals[r.data.currency]||0n)+BigInt(r.data.amountMinor);
  const budgets=list('Budget').filter(r=>r.data.month===month&&!r.data.category);
  const sessions=uniqueSessions(records);const goals=list('LearningGoal');
  const learning=goals.map(goal=>({...goal,minutes:sessions.filter(s=>s.data.goalId===goal.id).reduce((sum,s)=>sum+s.data.minutes,0)}));
  const habits=list('Habit').filter(r=>!r.data.archived).map(r=>({...r,todayState:habitStats(r,records,now).day}));const checkins=list('HabitCheckIn');
  const weekDay=new Date(`${today}T12:00:00Z`).getUTCDay();const weekStart=addDays(today,-((weekDay+6)%7));
  const habitDays=new Set(checkins.filter(r=>r.data.status==='done'&&r.data.date>=weekStart&&r.data.date<=today).map(r=>r.data.date)).size;
  return {today,month,tasks,schedule,expenses,totals,incomes,incomeTotals,budgets,learning,sessions,habits,checkins,habitDays,bookmarks:list('Bookmark').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),pendingTasks:tasks.length,activeGoals:goals.filter(r=>r.data.status==='active').length,studyMinutes:sessions.filter(s=>s.data.date.slice(0,7)===month).reduce((sum,s)=>sum+s.data.minutes,0)};
}
