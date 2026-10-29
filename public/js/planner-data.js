import { dateKey,addDays } from './date-utils.js';
export const taskStatuses={todo:'待办',in_progress:'进行中',done:'已完成'};
export const priorities={low:'低',normal:'普通',high:'高',urgent:'紧急'};
export const repeatLabels={daily:'天',weekly:'周',monthly:'月'};
/** @param {string} anchor @param {{frequency:string,interval:number,count:number}} rule */
export function repeatDates(anchor,rule){
  const [year,month,day]=anchor.split('-').map(Number);const dates=[];
  for(let i=0;i<rule.count;i++){
    let next;
    if(rule.frequency==='monthly'){
      const absolute=year*12+month-1+i*rule.interval;const y=Math.floor(absolute/12),m=absolute%12+1;
      if(y>9999||y<100)throw new Error('重复任务超出支持的日期范围');
      const last=new Date(Date.UTC(y,m,0)).getUTCDate();next=`${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(Math.min(day,last)).padStart(2,'0')}`;
    }else next=addDays(anchor,i*rule.interval*(rule.frequency==='weekly'?7:1));
    if(!/^\d{4}-\d{2}-\d{2}$/.test(next))throw new Error('重复任务超出支持的日期范围');dates.push(next);
  }
  return dates;
}
export function isTaskToday(task,now=new Date()){return task.data.dueDate===dateKey(now,task.data.timeZone||'Asia/Shanghai');}
export function isTaskWithinWeek(task,now=new Date()){const today=dateKey(now,task.data.timeZone||'Asia/Shanghai');return task.data.dueDate>=today&&task.data.dueDate<addDays(today,7);}
export function eventOnDate(event,key,zone){
  const d=event.data;if(d.allDay)return d.startDate<=key&&key<d.endDate;
  return dateKey(d.startAt,zone)<=key&&dateKey(new Date(Date.parse(d.endAt)-1),zone)>=key;
}
export function upcomingEvents(events,zone,now=new Date()){
  const today=dateKey(now,zone),until=addDays(today,7);
  return events.filter(r=>r.data.allDay?r.data.endDate>today&&r.data.startDate<until:Date.parse(r.data.endAt)>now.valueOf()&&dateKey(r.data.startAt,zone)<until)
    .sort((a,b)=>eventSortKey(a,zone).localeCompare(eventSortKey(b,zone)));
}
export function eventSortKey(event,zone){const d=event.data;return d.allDay?`${d.startDate}T00:00`:dateKey(d.startAt,zone)+'T'+new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(d.startAt));}
export function filterTasks(tasks,filters,now=new Date()){
  const search=(filters.search||'').trim().toLocaleLowerCase();
  return tasks.filter(r=>{
    const d=r.data;const tags=d.tags||[];
    return (filters.view==='all'||filters.view==='seven'&&isTaskWithinWeek(r,now)||filters.view==='today'&&isTaskToday(r,now))
      &&(!filters.status||filters.status==='all'||filters.status==='active'&&d.status!=='done'||filters.status===d.status)
      &&(!filters.priority||filters.priority==='all'||d.priority===filters.priority)
      &&(!filters.category||d.category===filters.category)
      &&(!filters.tag||tags.includes(filters.tag))
      &&(!search||[d.title,d.description||d.note||'',d.category||'',...tags].join(' ').toLocaleLowerCase().includes(search));
  }).sort((a,b)=>Number(a.data.status==='done')-Number(b.data.status==='done')||a.data.dueDate.localeCompare(b.data.dueDate)||['urgent','high','normal','low'].indexOf(a.data.priority)-['urgent','high','normal','low'].indexOf(b.data.priority)||a.createdAt.localeCompare(b.createdAt));
}
