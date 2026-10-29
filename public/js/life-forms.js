import {escape,zones} from './html-utils.js';
import {dateKey} from './date-utils.js';
import {habitStart} from './life-data.js';
import {typeLabels} from './model.js';
const input=(name,value='',extra='')=>`<input name="${name}" value="${escape(value)}" ${extra}>`;
const field=(label,control,full=false)=>`<label class="form-field ${full?'full':''}"><span>${label}</span>${control.replace(/<(input|select|textarea)\b/,(_,tag)=>`<${tag} aria-label="${escape(label)}"`)}</label>`;
const select=(name,value,items,extra='')=>`<select name="${name}" ${extra}>${items.map(([id,label])=>`<option value="${escape(id)}" ${id===value?'selected':''}>${escape(label)}</option>`).join('')}</select>`;
export const resourceRow=(r={})=>`<div class="resource-form-row">${field('资料标题',input('resourceTitle',r.title,'maxlength="160" required'))}${field('资料 URL',input('resourceUrl',r.url,'type="url" maxlength="2048" placeholder="https://" required'))}<button type="button" class="text-link" data-action="remove-life-row">移除资料</button></div>`;
export function stageRow(stage={},used=false){return `<div class="stage-form-row" data-stage-id="${stage.id||crypto.randomUUID()}">${field('阶段名称',input('stageTitle',stage.title,'maxlength="160" required'))}${field('阶段目标分钟数',input('stageMinutes',stage.targetMinutes,'type="number" min="1" max="1000000" required'))}${field('阶段期限（可选）',input('stageDeadline',stage.deadline,'type="date"'))}<button type="button" class="text-link" data-action="remove-life-row" ${used?'disabled title="已有学习记录，请先调整记录的阶段归属"':''}>移除阶段</button></div>`;}
export function lifeForm(type,record,store,p){
  const d=record?.data||{},today=dateKey(new Date(),p.timeZone);let controls='',description='保存失败时会显示原因并保留表单内容。';
  const title=field('标题',input('title',d.title,'maxlength="160" required'));
  if(type==='LearningGoal'){
    controls=title+field('总目标分钟数',input('targetMinutes',d.targetMinutes||600,'type="number" min="1" max="1000000" required'))+field('目标期限（可选）',input('deadline',d.deadline,'type="date"'))+field('目标状态',select('status',d.status||'active',[['active','进行中'],['completed','已完成']]));
    const used=store.list('StudySession').filter(r=>r.data.goalId===record?.id).map(r=>r.data.stageId);
    controls+=`<fieldset class="life-fieldset full"><legend>学习阶段</legend><p class="small-note">阶段目标合计不能超过总目标。时长只来自学习记录，不会把阶段和总目标重复相加。</p><div id="life-stages">${(d.stages||[]).map(s=>stageRow(s,used.includes(s.id))).join('')}</div><button type="button" class="text-link" data-action="add-stage">＋ 添加阶段</button></fieldset>`;
  }
  if(type==='StudySession'){
    controls=title+field('学习日期',input('date',d.date||today,'type="date" required'))+field('学习分钟数',input('minutes',d.minutes||30,'type="number" min="1" max="1440" required'))+field('关联学习目标',select('goalId',d.goalId||'',[['','独立学习'],...store.list('LearningGoal').map(g=>[g.id,g.data.title])]))+field('学习阶段',stageSelect(d.goalId,d.stageId,store));description='每条学习记录只计算一次；选择阶段不会额外增加时长。同一天合计最多 1440 分钟。';
  }
  if(['LearningGoal','StudySession'].includes(type))controls+=`<fieldset class="life-fieldset full"><legend>学习资料</legend><div id="life-resources">${(d.resources||[]).map(resourceRow).join('')}</div><button type="button" class="text-link" data-action="add-resource">＋ 添加资料链接</button></fieldset>`;
  if(type==='Habit'){
    const locked=!!record?.id&&store.list('HabitCheckIn').some(r=>r.data.habitId===record.id);
    controls=title+field('目标频率',select('frequency',d.frequency||'daily',[['daily','每天一次'],['weekly','每周若干天']]))+field('每周目标天数',input('weeklyTarget',d.weeklyTarget||7,'type="number" min="1" max="7" required'))+field('开始日期',input('startedOn',record?.id?habitStart(record):d.startedOn||today,`type="date" required ${locked?'readonly':''}`))+field('习惯时区',select('timeZone',d.timeZone||p.timeZone,zones.map(z=>[z,z]),locked?'disabled':''));
    controls+=`<fieldset class="life-fieldset full"><legend>计划日（未选择的星期为固定休息日）</legend><div class="weekday-checkboxes">${['一','二','三','四','五','六','日'].map((label,i)=>`<label><input name="weekdays" type="checkbox" value="${i+1}" ${(d.weekdays||[1,2,3,4,5,6,7]).includes(i+1)?'checked':''}>周${label}</label>`).join('')}</div></fieldset><input type="hidden" name="archived" value="${d.archived?'true':'false'}">${locked?`<input type="hidden" name="timeZone" value="${escape(d.timeZone)}">`:''}`;
    description='每天目标按计划日每天一次；每周目标按完成天数计算。已有打卡后，频率和计划日的调整从下周一生效，历史规则保留。开始日期和时区锁定。';
  }
  if(type==='HabitCheckIn'){
    const habit=store.get(d.habitId),zone=habit?.data.timeZone||p.timeZone,habits=store.list('Habit').filter(r=>!r.data.archived||r.id===d.habitId);
    controls=field('打卡习惯',select('habitId',d.habitId||'',[['','请选择习惯'],...habits.map(h=>[h.id,h.data.title])],record?.id?'disabled':'required'))+field('打卡日期',input('date',d.date||dateKey(new Date(),zone),`type="date" required ${record?.id?'readonly':''}`))+field('当天状态',select('status',d.status||'done',[['done','已完成'],['rest','休息日'],['void','已撤销']]));
    if(record?.id)controls+=`<input type="hidden" name="habitId" value="${d.habitId}">`;
    description='可补记开始日至今天的记录。撤销只改变当前状态，保留原打卡和每次变更；休息日不增加连续天数，也不打断连续记录。';
  }
  if(type==='Bookmark'){
    controls=title+field('网页 URL',input('url',d.url,'type="url" maxlength="2048" placeholder="https://" required'))+field('分类',input('category',d.category||'未分类','maxlength="60" list="bookmark-categories" required'))+field('标签（逗号分隔）',input('tags',(d.tags||[]).join(', '),'maxlength="640"'))+`<datalist id="bookmark-categories">${[...new Set(store.list('Bookmark').map(r=>r.data.category))].map(v=>`<option value="${escape(v)}"></option>`).join('')}</datalist>`;
    description='手动保存网页标题与链接，不自动请求网页。只接受无账号密码的 http/https 地址；外部页面在新标签安全打开。';
  }
  controls+=field(type==='Bookmark'?'个人笔记':type==='StudySession'?'学习笔记':'备注',`<textarea name="note" rows="4" maxlength="2000">${escape(d.note||'')}</textarea>`,true);
  return `<h2 id="dialog-title">${record?.id?'编辑':'新增'}${typeLabels[type]}</h2><p class="dialog-description">${description}</p><form id="record-form" data-type="${type}" data-operation-id="${crypto.randomUUID()}" ${record?.id?`data-id="${record.id}" data-version="${record.version}"`:''}><div class="form-grid">${controls}</div><p id="form-error" class="form-error" role="alert" hidden></p><div class="dialog-footer"><button type="button" class="button outline" data-action="close-dialog">取消</button><button type="submit" class="button solid">保存${typeLabels[type]}</button></div></form>`;
}
export function stageSelect(goalId,stageId,store){const goal=store.get(goalId);return select('stageId',stageId||'',[['','不指定阶段'],...(goal?.data.stages||[]).map(s=>[s.id,s.title])]);}
export function updateLifeForm(form,target,store){
  if(form.dataset.type==='StudySession'&&target.name==='goalId'){form.querySelector('[name="stageId"]').outerHTML=stageSelect(target.value,'',store);form.querySelector('[name="stageId"]').setAttribute('aria-label','学习阶段');}
  if(form.dataset.type==='Habit'&&target.name==='frequency')form.querySelector('[name="weeklyTarget"]').closest('label').hidden=target.value==='daily';
}
export function parseLifeForm(form){
  const raw=Object.fromEntries(new FormData(form)),type=form.dataset.type,d={note:String(raw.note||'').trim()};
  const get=key=>String(raw[key]||'').trim();
  if(type==='LearningGoal'){Object.assign(d,{title:get('title'),targetMinutes:Number(raw.targetMinutes),deadline:get('deadline')||null,status:raw.status,stages:[...form.querySelectorAll('.stage-form-row')].map(row=>({id:row.dataset.stageId,title:row.querySelector('[name="stageTitle"]').value.trim(),targetMinutes:Number(row.querySelector('[name="stageMinutes"]').value),deadline:row.querySelector('[name="stageDeadline"]').value||null}))});}
  if(type==='StudySession')Object.assign(d,{title:get('title'),date:raw.date,minutes:Number(raw.minutes),goalId:raw.goalId||null,stageId:raw.stageId||null});
  if(['LearningGoal','StudySession'].includes(type))d.resources=[...form.querySelectorAll('.resource-form-row')].map(row=>({title:row.querySelector('[name="resourceTitle"]').value.trim(),url:row.querySelector('[name="resourceUrl"]').value.trim()}));
  if(type==='Habit'){Object.assign(d,{title:get('title'),frequency:raw.frequency,weeklyTarget:Number(raw.weeklyTarget),weekdays:new FormData(form).getAll('weekdays').map(Number),startedOn:raw.startedOn,timeZone:raw.timeZone,archived:raw.archived==='true'});if(!d.weekdays.length)throw new Error('请至少选择一个计划日');}
  if(type==='HabitCheckIn')Object.assign(d,{habitId:raw.habitId,date:raw.date,status:raw.status});
  if(type==='Bookmark'){const values=get('tags').split(/[,，\n]/).map(v=>v.trim()).filter(Boolean);if(values.length>20||values.some(v=>v.length>30))throw new Error('最多 20 个标签，每个不超过 30 字');Object.assign(d,{title:get('title'),url:get('url'),category:get('category'),tags:[...new Set(values)]});}
  return d;
}
