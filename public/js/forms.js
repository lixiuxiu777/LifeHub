import { typeLabels } from './model.js';
import { CURRENCIES,parseAmount,amountInput } from './money.js';
import { localInput,localToISO } from './time.js';
import { dateKey } from './selectors.js';
import {escape,zones} from './html-utils.js';
import {taskForm,eventForm,parsePlannerForm} from './planner-forms.js';
import {financeForm,parseFinanceForm} from './finance-forms.js';
import {lifeForm,parseLifeForm} from './life-forms.js';
export {escape,zones};
const names={title:'标题',note:'备注',dueDate:'截止日期',priority:'优先级',status:'状态',startAt:'开始时间',endAt:'结束时间',timeZone:'日程时区',amount:'金额',currency:'货币',date:'记录日期',category:'分类',month:'预算月份',targetMinutes:'目标学习分钟数',goalId:'关联学习目标',minutes:'学习分钟数',habitId:'打卡习惯',url:'链接地址',tags:'标签'};
const fields={Task:['title','dueDate','priority','status','note'],CalendarEvent:['title','timeZone','startAt','endAt','note'],Expense:['title','currency','amount','date','category','note'],Budget:['currency','amount','month','note'],LearningGoal:['title','targetMinutes','status','note'],StudySession:['title','date','minutes','goalId','note'],Habit:['title','note'],HabitCheckIn:['habitId','date','note'],Bookmark:['title','url','tags','note']};
export function recordForm(type,record,store,p){
  if(['LearningGoal','StudySession','Habit','HabitCheckIn','Bookmark'].includes(type))return lifeForm(type,record,store,p);
  if(type==='Expense'||type==='Budget')return financeForm(type,record,store,p);
  if(type==='Task')return taskForm(record,store,p);if(type==='CalendarEvent')return eventForm(record,store,p);
  const d={...(record?.data||{})};const today=dateKey(new Date(),p.timeZone);d.currency??='CNY';d.timeZone??=p.timeZone;d.date??=today;d.dueDate??=today;d.month??=today.slice(0,7);d.priority??='normal';d.status??=type==='LearningGoal'?'active':'todo';
  const now=new Date();now.setSeconds(0,0);d.startAt=localInput(d.startAt||now,d.timeZone);d.endAt=localInput(d.endAt||new Date(now.valueOf()+3600000),d.timeZone);
  if(record?.data.amountMinor)d.amount=amountInput(record.data.amountMinor,d.currency);
  const options={currency:Object.keys(CURRENCIES).map(v=>[v,`${v} · ${CURRENCIES[v]} 位小数`]),priority:[['normal','普通'],['high','重要']],status:type==='LearningGoal'?[['active','进行中'],['completed','已完成']]:[['todo','待完成'],['done','已完成']],timeZone:zones.map(v=>[v,v]),category:['餐饮','交通','生活','学习','其他'].map(v=>[v,v]),goalId:[['','不关联目标'],...store.list('LearningGoal').map(r=>[r.id,r.data.title])],habitId:store.list('Habit').map(r=>[r.id,r.data.title])};
  const controls=fields[type].map(key=>{
    const value=d[key]??'';let control;
    if(options[key])control=`<select id="f-${key}" name="${key}" ${key==='habitId'?'required':''}>${key==='habitId'?'<option value="">请选择习惯</option>':''}${options[key].map(([v,label])=>`<option value="${escape(v)}" ${v===value?'selected':''}>${escape(label)}</option>`).join('')}</select>`;
    else if(key==='note')control=`<textarea id="f-note" name="note" maxlength="2000" rows="3">${escape(value)}</textarea>`;
    else{
      const inputType=key==='url'?'url':key==='month'?'month':['dueDate','date'].includes(key)?'date':['startAt','endAt'].includes(key)?'datetime-local':['minutes','targetMinutes'].includes(key)?'number':'text';
      control=`<input id="f-${key}" name="${key}" type="${inputType}" value="${escape(value)}" ${!['tags','note'].includes(key)?'required':''} ${key==='title'?'maxlength="160"':key==='tags'?'maxlength="200"':key==='url'?'maxlength="2048" placeholder="https://"':key==='amount'?'inputmode="decimal" maxlength="20" placeholder="例如 26.50"':key==='minutes'?'min="1" max="1440" step="1"':key==='targetMinutes'?'min="1" max="1000000" step="1"':''}>`;
    }
    return `<label class="form-field ${key==='note'?'full':''}" for="f-${key}"><span>${names[key]}</span>${control}</label>`;
  }).join('');
  return `<h2 id="dialog-title">${record?'编辑':'新增'}${typeLabels[type]}</h2><p class="dialog-description">${type==='CalendarEvent'?'按所选日程时区输入时间。夏令时不存在或重复的时间会提示修正。':type==='Expense'||type==='Budget'?'金额按所选货币精度保存为整数，不同货币独立统计。':type==='HabitCheckIn'?'同一习惯每天仅保留一次打卡。':'保存成功后，首页与相关模块会同步更新。'}</p>${type==='HabitCheckIn'&&!store.list('Habit').length?'<div class="preview-notice">请先建立一个习惯。<button class="text-link" data-action="create" data-type="Habit">新建习惯</button></div>':''}<form id="record-form" data-type="${type}" ${record?`data-id="${record.id}" data-version="${record.version}"`:''}><div class="form-grid">${controls}</div><p class="form-error" role="alert" id="form-error" hidden></p><div class="dialog-footer"><button type="button" class="button outline" data-action="close-dialog">取消</button><button type="submit" class="button solid">保存${typeLabels[type]}</button></div></form>`;
}
export function parseForm(form){
  if(['LearningGoal','StudySession','Habit','HabitCheckIn','Bookmark'].includes(form.dataset.type))return parseLifeForm(form);
  if(form.dataset.type==='Expense'||form.dataset.type==='Budget')return parseFinanceForm(form);
  if(form.dataset.type==='Task'||form.dataset.type==='CalendarEvent')return parsePlannerForm(form);
  const raw=Object.fromEntries(new FormData(form));const type=form.dataset.type;const d={};for(const key of fields[type])d[key]=String(raw[key]??'').trim();
  if('amount'in d){d.amountMinor=parseAmount(d.amount,d.currency);delete d.amount;}
  if(type==='CalendarEvent'){d.startAt=localToISO(d.startAt,d.timeZone);d.endAt=localToISO(d.endAt,d.timeZone);if(d.endAt<=d.startAt)throw new Error('结束时间必须晚于开始时间');}
  if('minutes'in d)d.minutes=Number(d.minutes);if('targetMinutes'in d)d.targetMinutes=Number(d.targetMinutes);if('goalId'in d)d.goalId=d.goalId||null;
  return d;
}
