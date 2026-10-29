import { icon } from './icons.js';
import { modules,cards,defaultPreferences,validatePreferences,STORAGE_KEY,typeLabels } from './model.js';
import { DataStore } from './store.js';
import { homeView,moduleView,settingsView,quickGrid,titleFor } from './views.js';
import { recordForm,parseForm,escape } from './forms.js';
import { dateKey,addDays } from './selectors.js';
import {plannerState,plannerView,shiftMonth} from './planner-view.js';
import {updatePlannerForm} from './planner-forms.js';

const $=selector=>document.querySelector(selector);
const store=new DataStore();let currentView='overview';let initialized=false;let dialogReturnFocus;let toastTimer;let pendingRestore=null;
const themeMedia=matchMedia('(prefers-color-scheme: dark)');const menuMedia=matchMedia('(max-width: 800px)');
const preference=()=>store.list('DashboardPreference')[0]?.data||defaultPreferences();
let planner=plannerState(defaultPreferences());
let legacy=null;try{const data=localStorage.getItem(STORAGE_KEY);if(data)legacy=validatePreferences(JSON.parse(data));}catch{/* Legacy data is optional; never overwrite database records automatically. */}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>{$('#toast').hidden=true;},5000);}
function applyTheme(){const p=preference();const dark=p.theme==='dark'||p.theme==='system'&&themeMedia.matches;document.documentElement.dataset.theme=dark?'dark':'light';$('#theme-toggle').innerHTML=icon(dark?'sun':'moon');$('#theme-toggle').setAttribute('aria-label',dark?'切换到浅色主题':'切换到深色主题');}
function route(){return location.hash.replace('#/','')||'home';}
function closeMenu(){$('#sidebar').classList.remove('open');$('#sidebar').inert=menuMedia.matches;$('#sidebar-backdrop').hidden=true;$('#mobile-menu').setAttribute('aria-expanded','false');}
function toggleMenu(){const open=$('#sidebar').classList.toggle('open');$('#sidebar').inert=menuMedia.matches&&!open;$('#sidebar-backdrop').hidden=!open;$('#mobile-menu').setAttribute('aria-expanded',String(open));if(open)$('#navigation a').focus();}
function render(){
  applyTheme();const current=modules.find(m=>m.id===route());
  $('#navigation').innerHTML=modules.filter(m=>m.id!=='settings').map(m=>`<a href="#/${m.id}" ${m.id===current?.id?'aria-current="page"':''}>${icon(m.icon)}<span>${m.label}</span>${m.id==='home'?'<span class="nav-active-dot"></span>':''}</a>`).join('');
  $('#settings-link').innerHTML=`${icon('settings')}<span>设置与数据备份</span>`;
  if(current?.id==='settings')$('#settings-link').setAttribute('aria-current','page');else $('#settings-link').removeAttribute('aria-current');
  $('#breadcrumb-current').textContent=current?.label||'页面未找到';document.title=`${current?.label||'页面未找到'} · LifeHub`;
  $('.local-badge').textContent=store.busy?(store.loading?'正在加载记录…':'正在同步…'):store.error?'连接异常 · 请刷新':store.environment==='cloud'?'私有云端 · 已连接':'本机开发库 · 不跨设备同步';
  const error=store.error?`<div class="preview-notice" role="alert">${icon('info')}<span>${escape(store.error)}${store.lastSynced?' 当前显示上次成功读取的数据，可能不是最新。':''}</span><button class="text-link" data-action="refresh">重试</button><a class="text-link" href="/signin-with-chatgpt?return_to=%2F" target="_top">重新登录</a></div>`:'';
  let body;
  if(store.loading)body=`<section class="no-cards" role="status"><div class="skeleton"></div><h2>正在读取你的生活空间</h2><p>数据加载完成前，不显示任何统计数字。</p></section>`;
  else if(!store.lastSynced)body=`<section class="no-cards"><h1>暂时无法读取记录</h1><p>请检查连接并重试。尚未读取到数据，不代表没有记录。</p><button class="button solid" data-action="refresh">重新连接</button></section>`;
  else if(!current)body='<section class="no-cards"><h1>页面不存在</h1><a class="button solid" href="#/home">返回首页</a></section>';
  else body=current.id==='home'?homeView(store,preference(),currentView):current.id==='settings'?settingsView(store,preference(),legacy):current.id==='tasks'?plannerView(store,preference(),planner):moduleView(current,store,preference());
  const undo=store.lastSynced&&(store.undo||current?.id==='tasks')?`<div class="undo-banner" role="status"><span>${icon('refresh')}${store.undo?'最近操作：'+escape(store.undo.label):'可撤销最近一步待办或日程操作'}</span><button class="text-link" data-action="undo" ${!store.undo||store.busy?'disabled':''}>撤销最近操作</button></div>`:'';
  $('#main').innerHTML=error+undo+body;
}
function openDialog(content){if(!$('#app-dialog').open)dialogReturnFocus=document.activeElement;$('#app-dialog').innerHTML=`<div class="dialog-top"><span class="eyebrow">LIFEHUB</span><button class="icon-button" data-action="close-dialog" aria-label="关闭弹窗">${icon('close')}</button></div>${content}`;if(!$('#app-dialog').open)$('#app-dialog').showModal();}
function closeDialog(){if(store.busy){toast('正在处理，请稍候。');return;}$('#app-dialog').close();pendingRestore=null;if(dialogReturnFocus?.isConnected)dialogReturnFocus.focus();}
async function savePreferences(data){const record=store.list('DashboardPreference')[0];await store.mutate(record?'PATCH':'POST','DashboardPreference',validatePreferences(data),record);}
function customize(focus){
  const p=preference();openDialog(`<h2 id="dialog-title">你的首页，你来安排</h2><p class="dialog-description">勾选卡片并用箭头调整顺序。每次修改都会保存到当前数据空间，失败时保留原配置。</p><div class="customize-list">${p.order.map((id,index)=>{const card=cards.find(c=>c.id===id);return `<div class="customize-row"><label>${icon(card.icon)}<span>${card.title}</span><input type="checkbox" data-card-toggle="${id}" ${p.hidden.includes(id)?'':'checked'} aria-label="显示${card.title}"></label><div><button class="icon-button" data-action="move-up" data-id="${id}" aria-label="上移${card.title}" ${index===0?'disabled':''}>${icon('up')}</button><button class="icon-button" data-action="move-down" data-id="${id}" aria-label="下移${card.title}" ${index===p.order.length-1?'disabled':''}>${icon('down')}</button></div></div>`;}).join('')}</div><div class="dialog-footer"><button class="text-link" data-action="reset-layout">恢复默认布局</button><button class="button solid" data-action="close-dialog">完成</button></div>`);
  if(focus)$('#app-dialog').querySelector(focus)?.focus();
}
function create(type,seed){openDialog(recordForm(type,seed?{data:seed}:null,store,preference()));}
function quickAdd(){openDialog(`<h2 id="dialog-title">记录一件小事</h2><p class="dialog-description">选择想记录的内容，保存后会更新首页摘要。</p>${quickGrid()}`);}
function confirmDelete(record){
  const plannerRecord=['Task','CalendarEvent'].includes(record.type),operationId=crypto.randomUUID();
  const message=record.type==='Task'?`${record.data.seriesId?'仅删除当前重复实例，其他实例与历史保留。':''}子任务会保留并提升为顶层任务，关联日程保留并解除链接。可撤销最近一步。`:record.type==='CalendarEvent'?'只删除此日程，关联任务保留。可撤销最近一步。':'删除后首页摘要会更新。此类记录请通过备份恢复。';
  openDialog(`<h2 id="dialog-title">删除这条${typeLabels[record.type]}？</h2><p class="dialog-description">${escape(titleFor(record,store))}<br>${message}</p><div class="dialog-footer"><button class="button outline" data-action="close-dialog">取消</button><button class="button danger" id="confirm-delete">确认删除</button></div>`);
  $('#confirm-delete').addEventListener('click',()=>act(async()=>{await store.mutate('DELETE',record.type,null,record,operationId);closeDialog();toast(plannerRecord?'记录已删除，可撤销最近操作。':'记录已删除。');}));
}
function exportBackup(){
  if(!store.lastSynced||store.error)throw new Error('请先成功刷新数据，再导出完整备份。');
  const blob=new Blob([JSON.stringify(store.backup(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`lifehub-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('已发起完整备份下载，请妥善保存文件。');
}
function importDialog(){openDialog(`<h2 id="dialog-title">恢复生活空间</h2><p class="dialog-description">恢复会替换当前账户的全部记录与配置。请先导出当前备份。选择文件，或直接粘贴 LifeHub V2 格式的备份 JSON。</p><form id="backup-form"><label class="form-field"><span>选择备份文件（可选）</span><input type="file" id="backup-file" accept="application/json,.json"></label><label class="form-field"><span>备份 JSON</span><textarea name="backup" id="backup-text" aria-label="备份 JSON" rows="8" maxlength="2000000" required></textarea></label><p id="backup-error" class="form-error" role="alert" hidden></p><div class="dialog-footer"><button type="button" class="button outline" data-action="close-dialog">取消</button><button type="submit" class="button solid">预览恢复</button></div></form>`);}
function previewRestore(text){
  if(text.length>2_000_000)throw new Error('备份超过 2 MB 限制。');let backup;try{backup=JSON.parse(text);}catch{throw new Error('JSON 格式无效。');}
  if(backup.format!=='lifehub-backup'||backup.version!==2||!Array.isArray(backup.records)||backup.records.length>1000)throw new Error('请使用 LifeHub V2 格式备份，最多 1000 条记录。');
  pendingRestore={backup,expectedState:store.stateKey};
  openDialog(`<h2 id="dialog-title">确认替换当前数据？</h2><p class="dialog-description">备份包含 ${backup.records.length} 条记录（含配置）。将替换当前 ${store.records.length} 条记录。服务器会校验所有字段、关联与记录版本；任一失败会回滚整个恢复。</p><p class="small-note">创建时间与 ID 保留，更新时间和版本刷新。恢复不会改变站点访问权限。</p><div class="dialog-footer"><button class="button outline" data-action="close-dialog">取消</button><button class="button danger" data-action="restore-confirm">确认恢复并替换</button></div>`);
}
async function act(action){if(store.busy){toast('正在保存或刷新，请稍候。');return;}try{await action();}catch(error){toast(error.message);}}
document.addEventListener('click',event=>{
  const el=event.target.closest('[data-action]');if(!el||el.disabled)return;const a=el.dataset.action;
  if(a==='close-dialog'){closeDialog();return;}
  if(a==='create'){if(store.lastSynced&&!store.busy)create(el.dataset.type,el.dataset.type==='CalendarEvent'&&route()==='tasks'&&planner.panel==='calendar'?{allDay:true,startDate:planner.selectedDay,endDate:addDays(planner.selectedDay,1)}:null);return;}
  if(a==='quick-add'){if(store.lastSynced&&!store.busy)quickAdd();return;}
  if(a==='customize'){if(store.lastSynced&&!store.busy)customize();return;}
  if(a==='edit'){const record=store.get(el.dataset.id);if(record&&!store.busy)openDialog(recordForm(record.type,record,store,preference()));return;}
  if(a==='delete'){const record=store.get(el.dataset.id);if(record&&!store.busy)confirmDelete(record);return;}
  if(a==='import'){importDialog();return;}
  if(a==='planner-panel'){planner.panel=el.dataset.panel;render();return;}
  if(a==='task-view'){planner.view=el.dataset.view;planner.status=planner.view==='all'?'all':'active';render();return;}
  if(a==='planner-all'){planner.panel='tasks';planner.view='all';planner.status='active';planner.search='';planner.priority='all';planner.category=planner.tag='';render();return;}
  if(a==='reset-task-filters'){const base=plannerState(preference());planner={...planner,status:planner.view==='all'?'all':'active',priority:base.priority,category:base.category,tag:base.tag,search:''};render();return;}
  if(a==='calendar-prev'||a==='calendar-next'){planner.month=shiftMonth(planner.month,a==='calendar-prev'?-1:1);planner.selectedDay=planner.month+'-01';render();return;}
  if(a==='calendar-today'){planner.selectedDay=dateKey(new Date(),preference().timeZone);planner.month=planner.selectedDay.slice(0,7);render();return;}
  if(a==='calendar-select'){planner.selectedDay=el.dataset.date;planner.month=planner.selectedDay.slice(0,7);render();return;}
  if(a==='calendar-add'){create('CalendarEvent',{allDay:true,startDate:planner.selectedDay,endDate:addDays(planner.selectedDay,1)});return;}
  if(a==='add-subtask'){const parent=store.get(el.dataset.id);create('Task',{parentTaskId:parent.id,dueDate:parent.data.dueDate,timeZone:parent.data.timeZone,category:parent.data.category});return;}
  if(a==='link-event'){const task=store.get(el.dataset.id);create('CalendarEvent',{title:task.data.title,taskId:task.id,timeZone:task.data.timeZone});return;}
  act(async()=>{
    if(a==='refresh'){await store.refresh();toast('已重新读取数据库。');}
    if(a==='export')exportBackup();
    if(a==='undo'){await store.undoLast();toast('最近一步已撤销，事项与首页已更新。');}
    if(a==='cycle-task'){const r=store.get(el.dataset.id);await store.mutate('PATCH','Task',{...r.data,status:{todo:'in_progress',in_progress:'done',done:'todo'}[r.data.status]},r);toast('任务状态已保存，可撤销最近操作。');}
    if(a==='reset-layout'){const p=preference();await savePreferences({...p,order:cards.map(c=>c.id),hidden:[],defaultView:'overview'});currentView='overview';render();customize('[data-action="reset-layout"]');toast('默认布局已保存。');}
    if(a==='move-up'||a==='move-down'){
      const p=preference();const order=[...p.order];const index=order.indexOf(el.dataset.id),target=index+(a==='move-up'?-1:1);if(target<0||target>=order.length)return;[order[index],order[target]]=[order[target],order[index]];
      await savePreferences({...p,order});customize(`[data-id="${el.dataset.id}"]:not(:disabled)`);
    }
    if(a==='toggle-task'){const r=store.get(el.dataset.id);await store.mutate('PATCH',r.type,{...r.data,status:r.data.status==='done'?'todo':'done'},r);toast('待办状态已更新。');}
    if(a==='checkin'){await store.mutate('POST','HabitCheckIn',{habitId:el.dataset.id,date:dateKey(new Date(),preference().timeZone),note:''});toast('今天的坚持，已记录。');}
    if(a==='restore-confirm'&&pendingRestore){const pending=pendingRestore;await store.restore(pending.backup,pending.expectedState);currentView=preference().defaultView;closeDialog();render();toast('记录与首页配置已恢复。');}
    if(a==='migrate-legacy'&&legacy){await savePreferences({...preference(),order:legacy.order,hidden:legacy.hidden,theme:legacy.theme});legacy=null;render();toast('已将原本机布局保存到当前数据空间。');}
  });
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.closest('#record-form'))updatePlannerForm(el.closest('#record-form'),el);
  if(el.dataset.taskFilter){planner[el.dataset.taskFilter]=el.value;render();return;}
  if(el.dataset.calendarOption){planner[el.dataset.calendarOption]=el.checked;render();return;}
  if(el.id==='current-view'){currentView=el.value;render();return;}
  if(el.id==='backup-file'&&el.files[0]){const file=el.files[0];if(file.size>2_000_000){toast('文件超过 2 MB 限制。');el.value='';return;}file.text().then(text=>{$('#backup-text').value=text;}).catch(()=>toast('无法读取文件，请改用粘贴 JSON。'));return;}
  if(el.dataset.preference){if(store.busy){render();return;}act(async()=>{const value=el.value;await savePreferences({...preference(),[el.dataset.preference]:value});if(el.dataset.preference==='defaultView'){currentView=value;render();}toast('偏好已保存。');});}
  if(el.dataset.cardToggle){if(store.busy){el.checked=!el.checked;return;}act(async()=>{const p=preference();const hidden=el.checked?p.hidden.filter(v=>v!==el.dataset.cardToggle):[...p.hidden,el.dataset.cardToggle];try{await savePreferences({...p,hidden});}catch(error){el.checked=!p.hidden.includes(el.dataset.cardToggle);throw error;}});}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!['record-form','backup-form'].includes(form.id))return;event.preventDefault();
  if(form.id==='backup-form'){try{previewRestore($('#backup-text').value);}catch(error){$('#backup-error').hidden=false;$('#backup-error').textContent=error.message;}return;}
  if(store.busy)return;const errorEl=$('#form-error');const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='正在保存…';errorEl.hidden=true;
  try{const data=parseForm(form);await store.mutate(form.dataset.id?'PATCH':'POST',form.dataset.type,data,form.dataset.id?{id:form.dataset.id,version:Number(form.dataset.version)}:null,form.dataset.operationId);closeDialog();toast(data.recurrence&&!form.dataset.id?`已保存 ${data.recurrence.count} 个独立任务实例。`:'记录已保存，首页摘要已更新。');}
  catch(error){errorEl.textContent=error.message;errorEl.hidden=false;}
  finally{if(submit.isConnected){submit.disabled=false;submit.textContent='保存'+typeLabels[form.dataset.type];}}
});
$('#app-dialog').addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
$('#app-dialog').addEventListener('click',event=>{if(event.target===$('#app-dialog'))closeDialog();});
$('#theme-toggle').addEventListener('click',()=>act(()=>savePreferences({...preference(),theme:document.documentElement.dataset.theme==='dark'?'light':'dark'})));
$('#mobile-menu').innerHTML=icon('menu');$('#mobile-menu').addEventListener('click',toggleMenu);$('#sidebar-backdrop').addEventListener('click',closeMenu);menuMedia.addEventListener('change',closeMenu);themeMedia.addEventListener('change',applyTheme);
$('#sidebar').addEventListener('click',event=>{if(event.target.closest('a')&&menuMedia.matches){closeMenu();$('#main').focus();}});
$('.skip').addEventListener('click',event=>{event.preventDefault();$('#main').focus();$('#main').scrollIntoView();});
document.addEventListener('keydown',event=>{if(!$('#sidebar').classList.contains('open'))return;if(event.key==='Escape'){closeMenu();$('#mobile-menu').focus();}if(event.key==='Tab'&&menuMedia.matches){const links=[...$('#sidebar').querySelectorAll('a')];if(event.shiftKey&&document.activeElement===links[0]){event.preventDefault();links.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===links.at(-1)){event.preventDefault();links[0].focus();}}});
window.addEventListener('hashchange',()=>{if($('#app-dialog').open&&!store.busy)closeDialog();closeMenu();render();$('#main').focus();window.scrollTo({top:0});});
store.addEventListener('change',render);
window.addEventListener('focus',()=>{if(initialized&&!store.busy&&!$('#app-dialog').open)store.refresh().catch(()=>{});});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&initialized&&!store.busy&&!$('#app-dialog').open)store.refresh().catch(()=>{});});
document.addEventListener('input',event=>{if(event.target.id!=='task-search')return;const start=event.target.selectionStart,end=event.target.selectionEnd;planner.search=event.target.value;render();const field=$('#task-search');field.focus();field.setSelectionRange(start,end);});
render();closeMenu();
try{await store.refresh();if(!store.list('DashboardPreference').length){try{await savePreferences(defaultPreferences());}catch(error){if(error.status===409)await store.refresh();else throw error;}}currentView=preference().defaultView;planner=plannerState(preference());initialized=true;render();}catch(error){toast(error.message);}
