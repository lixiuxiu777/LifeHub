import {escape,zones} from './html-utils.js';
import {dateKey,addDays} from './date-utils.js';
import {localInput,localToISO} from './time.js';
import {taskStatuses,priorities} from './planner-data.js';
const option=(value,label,selected)=>`<option value="${escape(value)}" ${value===selected?'selected':''}>${escape(label)}</option>`;
const taskLabel=r=>`${r.data.dueDate} · ${r.data.title.slice(0,70)}${r.data.seriesId?' · 实例 '+r.data.occurrenceIndex:''}`;
const select=(name,label,options,value)=>`<label class="form-field"><span>${label}</span><select name="${name}" aria-label="${label}">${options.map(([v,l])=>option(v,l,value)).join('')}</select></label>`;
const input=(name,label,value,type='text',extra='')=>`<label class="form-field"><span>${label}</span><input name="${name}" aria-label="${label}" type="${type}" value="${escape(value)}" ${extra}></label>`;
const footer=label=>`<p class="form-error" role="alert" id="form-error" hidden></p><div class="dialog-footer"><button type="button" class="button outline" data-action="close-dialog">取消</button><button type="submit" class="button solid">保存${label}</button></div>`;
function formTag(type,record,extra=''){return `<form id="record-form" data-type="${type}" data-operation-id="${crypto.randomUUID()}" ${record?.id?`data-id="${record.id}" data-version="${record.version}"`:''} ${extra}>`;}
export function taskForm(record,store,p){
  const d={title:'',description:'',dueDate:dateKey(new Date(),p.timeZone),status:'todo',priority:'normal',category:'未分类',tags:[],timeZone:p.timeZone,parentTaskId:null,recurrence:null,seriesId:null,occurrenceDate:null,occurrenceIndex:null,...record?.data};
  const excluded=new Set(record?.id?[record.id]:[]);let changed=true;
  while(changed){changed=false;for(const r of store.list('Task'))if(r.data.parentTaskId&&excluded.has(r.data.parentTaskId)&&!excluded.has(r.id)){excluded.add(r.id);changed=true;}}
  const parents=[['','顶层任务'],...store.list('Task').filter(r=>!excluded.has(r.id)).map(r=>[r.id,taskLabel(r)])];
  const categories=[...new Set(store.list('Task').map(r=>r.data.category||'未分类'))];
  return `<h2 id="dialog-title">${record?.id?'编辑':'新增'}待办任务</h2><p class="dialog-description">截止日按任务时区解释。${d.seriesId?'此处仅修改当前独立实例，不改变其他实例与历史记录。':'重复计划一次生成独立实例，完成任务不会额外生成同批任务。'}</p>${formTag('Task',record,`data-series-rule="${escape(JSON.stringify(d.recurrence))}"`)}<div class="form-grid">
    ${input('title','标题',d.title,'text','required maxlength="160"')}
    <label class="form-field full"><span>描述</span><textarea name="description" aria-label="描述" rows="4" maxlength="4000">${escape(d.description||d.note||'')}</textarea></label>
    ${select('status','任务状态',Object.entries(taskStatuses),d.status)}${select('priority','优先级',Object.entries(priorities),d.priority)}
    ${input('dueDate','截止日期',d.dueDate,'date','required')}${select('timeZone','任务时区',zones.map(z=>[z,z]),d.timeZone)}
    ${input('category','分类',d.category,'text','maxlength="60" list="task-categories"')}<datalist id="task-categories">${categories.map(v=>`<option value="${escape(v)}"></option>`).join('')}</datalist>
    ${input('tags','标签（逗号分隔）',(d.tags||[]).join(', '),'text','maxlength="620"')}${select('parentTaskId','父任务',parents,d.parentTaskId||'')}
    <fieldset class="repeat-fieldset full"><legend>重复计划</legend><label class="form-field"><span>重复频率</span><select name="repeatFrequency" aria-label="重复频率" ${d.seriesId?'disabled':''}>${[['none','不重复'],['daily','按天'],['weekly','按周'],['monthly','按月']].map(([v,l])=>option(v,l,d.recurrence?.frequency||'none')).join('')}</select></label><div id="repeat-controls" class="form-grid"><label class="form-field"><span>每隔多少天 / 周 / 月</span><input name="repeatInterval" aria-label="重复间隔" type="number" min="1" max="30" value="${d.recurrence?.interval||1}" ${!d.recurrence||d.seriesId?'disabled':''}></label><label class="form-field"><span>实例总数（含第一条）</span><input name="repeatCount" aria-label="重复实例总数" type="number" min="2" max="60" value="${d.recurrence?.count||12}" ${!d.recurrence||d.seriesId?'disabled':''}></label></div><p class="small-note">${d.seriesId?`当前是第 ${d.occurrenceIndex} / ${d.recurrence.count} 个实例，原计划 ${escape(d.occurrenceDate)}。重复规则不可在单条实例中修改。`:'每次最多 60 个实例。按月遇到不存在的日期取该月末日，后续月份仍按原始日期计算。子任务不能单独建立重复计划。'}</p></fieldset>
    <input type="hidden" name="seriesId" value="${d.seriesId||''}"><input type="hidden" name="occurrenceDate" value="${d.occurrenceDate||''}"><input type="hidden" name="occurrenceIndex" value="${d.occurrenceIndex||''}">
  </div>${footer('待办任务')}</form>`;
}
export function eventForm(record,store,p){
  const now=new Date();now.setSeconds(0,0);const today=dateKey(now,p.timeZone);
  const d={title:'',note:'',allDay:false,timeZone:p.timeZone,taskId:null,startAt:now.toISOString(),endAt:new Date(now.valueOf()+3600000).toISOString(),startDate:today,endDate:addDays(today,1),...record?.data};
  return `<h2 id="dialog-title">${record?.id?'编辑':'新增'}日程</h2><p class="dialog-description">定时事件按所选时区输入并保存为 UTC。全天事件保持日历日期，不随显示时区平移。</p>${formTag('CalendarEvent',record)}<div class="form-grid">
    ${input('title','标题',d.title,'text','required maxlength="160"')}
    <label class="checkbox-field full"><input type="checkbox" name="allDay" ${d.allDay?'checked':''}>全天事件</label>
    ${select('timeZone','日程时区',zones.map(z=>[z,z]),d.timeZone)}${select('taskId','关联任务',[['','不关联任务'],...store.list('Task').map(r=>[r.id,taskLabel(r)])],d.taskId||'')}
    <fieldset id="event-timed-fields" class="form-grid full plain-fieldset" ${d.allDay?'disabled':''}>${input('startAt','开始时间',localInput(d.startAt||now,d.timeZone),'datetime-local','required')}${input('endAt','结束时间',localInput(d.endAt||new Date(now.valueOf()+3600000),d.timeZone),'datetime-local','required')}</fieldset>
    <fieldset id="event-allday-fields" class="form-grid full plain-fieldset" ${!d.allDay?'disabled':''}>${input('startDate','开始日期',d.startDate||today,'date','required')}${input('endDateInclusive','结束日期（包含当天）',d.endDate?addDays(d.endDate,-1):today,'date','required')}</fieldset>
    <label class="form-field full"><span>描述</span><textarea name="note" aria-label="日程描述" rows="3" maxlength="2000">${escape(d.note)}</textarea></label>
  </div>${footer('日程')}</form>`;
}
export function parsePlannerForm(form){
  const raw=Object.fromEntries(new FormData(form));
  if(form.dataset.type==='Task'){
    const recurrence=raw.seriesId?JSON.parse(form.dataset.seriesRule):raw.repeatFrequency==='none'?null:{frequency:raw.repeatFrequency,interval:Number(raw.repeatInterval),count:Number(raw.repeatCount)};
    return {title:String(raw.title).trim(),description:String(raw.description||'').trim(),dueDate:raw.dueDate,status:raw.status,priority:raw.priority,category:String(raw.category||'未分类').trim(),tags:[...new Set(String(raw.tags||'').split(/[,，\n]/).map(t=>t.trim()).filter(Boolean))],timeZone:raw.timeZone,parentTaskId:raw.parentTaskId||null,recurrence,seriesId:raw.seriesId||null,occurrenceDate:raw.occurrenceDate||null,occurrenceIndex:raw.occurrenceIndex?Number(raw.occurrenceIndex):null};
  }
  const allDay=raw.allDay==='on';
  const data={title:String(raw.title).trim(),note:String(raw.note||'').trim(),timeZone:raw.timeZone,taskId:raw.taskId||null,allDay,startAt:null,endAt:null,startDate:null,endDate:null};
  if(allDay){data.startDate=raw.startDate;data.endDate=addDays(raw.endDateInclusive,1);if(data.endDate<=data.startDate)throw new Error('结束日期不能早于开始日期');}
  else{data.startAt=localToISO(raw.startAt,raw.timeZone);data.endAt=localToISO(raw.endAt,raw.timeZone);if(data.endAt<=data.startAt)throw new Error('结束时间必须晚于开始时间');}
  return data;
}
export function updatePlannerForm(form,target){
  if(target.name==='allDay'){$('#event-timed-fields').disabled=target.checked;$('#event-allday-fields').disabled=!target.checked;}
  if(target.name==='repeatFrequency')for(const el of form.querySelectorAll('#repeat-controls input'))el.disabled=target.value==='none';
}
function $(selector){return document.querySelector(selector);}
