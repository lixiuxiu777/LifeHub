import { icon } from './icons.js';
import { modules, cards, defaultPreferences, validatePreferences, STORAGE_KEY } from './model.js';
import { heroArt, emptyCard, demoCard, loadingCard, errorCard, quickCard, badge } from './components.js';

const $ = selector => document.querySelector(selector);
let preferences = defaultPreferences();
let storageIssue = false;
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) preferences = validatePreferences(JSON.parse(stored));
} catch { storageIssue = true; }
let viewMode = 'empty';
let toastTimer;
let dialogReturnFocus;
const media = matchMedia('(prefers-color-scheme: dark)');
const menuMedia = matchMedia('(max-width: 800px)');
function applyTheme() {
  const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#theme-toggle').innerHTML = icon(dark ? 'sun' : 'moon');
  $('#theme-toggle').setAttribute('aria-label', dark ? '切换到浅色主题' : '切换到深色主题');
}
media.addEventListener('change', applyTheme);
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); storageIssue = false; return true; }
  catch { storageIssue = true; toast('浏览器存储不可用。本次修改仅在当前页面有效。'); return false; }
}
function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}
function route() { return location.hash.replace('#/', '') || 'home'; }
function closeMenu() { $('#sidebar').classList.remove('open'); $('#sidebar').inert = menuMedia.matches; $('#sidebar-backdrop').hidden = true; $('#mobile-menu').setAttribute('aria-expanded', 'false'); }
function toggleMenu() {
  const open = $('#sidebar').classList.toggle('open');
  $('#sidebar').inert = menuMedia.matches && !open;
  $('#sidebar-backdrop').hidden = !open; $('#mobile-menu').setAttribute('aria-expanded', String(open));
  if (open) $('#navigation a').focus();
}
function dateParts() {
  const date = new Date();
  const parts = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' }).format(date);
  return parts;
}
function renderCard(card) {
  let body = card.id === 'quick' ? quickCard() : viewMode === 'demo' ? demoCard(card.id) : viewMode === 'loading' ? loadingCard() : viewMode === 'error' ? errorCard() : emptyCard(card);
  return `<article class="dashboard-card ${card.id === 'quick' ? 'quick-card' : ''}" data-card="${card.id}" aria-labelledby="card-${card.id}"><header class="card-header"><div><span class="card-icon ${card.color}">${icon(card.icon)}</span><h2 id="card-${card.id}">${card.title}</h2>${viewMode === 'demo' && card.id !== 'quick' ? badge : ''}</div>${card.route ? `<a class="card-more" href="#/${card.route}" aria-label="查看${card.title}模块">${icon('arrow')}</a>` : '<span class="subtle-pill">功能入口</span>'}</header>${body}</article>`;
}
function renderHome() {
  const visible = preferences.order.filter(id => !preferences.hidden.includes(id));
  return `<section class="page-heading"><div><p class="eyebrow">YOUR LIFE, IN ONE PLACE</p><h1>生活总览<span class="heading-period">.</span></h1><p>把日常安排好，把时间留给热爱。</p></div><div class="heading-actions"><span class="date-label">${icon('calendar')}${dateParts()}</span><button class="button outline" data-action="customize">${icon('tune')}自定义首页</button></div></section>
    <section class="welcome-banner"><div class="welcome-copy"><span class="welcome-kicker">A LITTLE SPACE FOR YOURSELF</span><h2>每一天，都有新的可能。</h2><p>从一件小事开始，慢慢整理出自己的生活节奏。</p><button class="button solid" data-action="quick-add">${icon('plus')}从这里开始</button></div>${heroArt()}</section>
    <section class="overview-strip" aria-label="生活概览">${[{label:'今日待办',icon:'tasks',suffix:'项待完成',value:'2'},{label:'本月支出',icon:'wallet',suffix:'人民币',value:'¥1,280'},{label:'学习计划',icon:'learn',suffix:'个进行中',value:'1'},{label:'本周习惯',icon:'habit',suffix:'天已打卡',value:'4'}].map(s=>`<div class="overview-item"><span class="overview-icon">${icon(s.icon)}</span><div><small>${s.label}${viewMode==='demo'?' · 演示':''}</small><p>${viewMode==='demo'?s.value:'—'}<span>${viewMode==='demo'?s.suffix:'待接入'}</span></p></div></div>`).join('')}</section>
    <div class="section-toolbar"><div><h2>我的日常</h2><span>${visible.length} 张卡片</span></div><div><label class="mode-label" for="view-mode">显示状态</label><select id="view-mode" aria-label="首页显示状态"><option value="empty" ${viewMode==='empty'?'selected':''}>空状态 · 未接入数据</option><option value="demo" ${viewMode==='demo'?'selected':''}>演示预览</option><option value="loading" ${viewMode==='loading'?'selected':''}>加载状态预览</option><option value="error" ${viewMode==='error'?'selected':''}>错误状态预览</option></select></div></div>
    ${viewMode!=='empty'?`<div class="preview-notice" role="status">${icon('info')}<span>${viewMode==='demo'?'你正在查看演示数据。所有内容均为虚构示例，不代表你的个人记录。':'当前为组件状态预览，没有发起数据请求。'}</span><button class="text-link" data-action="retry">退出预览</button></div>`:''}
    ${visible.length?`<section class="dashboard-grid" aria-label="首页卡片">${visible.map(id => renderCard(cards.find(c=>c.id===id))).join('')}</section>`:`<section class="no-cards">${icon('home')}<h2>留白，也是一种开始</h2><p>所有卡片已隐藏。随时选择你想看见的生活片段。</p><button class="button solid" data-action="customize">选择卡片</button></section>`}
    <div class="privacy-footnote">${icon('shield')}当前没有个人业务记录。主题与卡片偏好仅保存在此浏览器，云端同步尚未启用。</div>`;
}
function renderModule(module) {
  return `<section class="page-heading"><div><p class="eyebrow">YOUR PERSONAL SPACE</p><h1>${module.label}<span class="heading-period">.</span></h1><p>${module.subtitle}</p></div><span class="stage-pill">后续阶段开放</span></section><section class="module-placeholder"><span class="module-icon">${icon(module.icon)}</span><span class="subtle-pill">V1 · 模块规划</span><h2>为${module.label}，留好一个位置</h2><p>页面布局已就绪。这一阶段先搭好生活空间，<br>后续逐步接入真实记录与云端存储。</p><div class="feature-list">${module.features.map((f,i)=>`<div><span>0${i+1}</span>${f}<small>待开发</small></div>`).join('')}</div><a class="button solid" href="#/home">${icon('home')}返回生活总览</a><a class="text-link" href="#/settings">查看数据与同步方案 ${icon('arrow')}</a></section>`;
}
function renderSettings() {
  return `<section class="page-heading"><div><p class="eyebrow">MAKE IT YOURS</p><h1>设置与数据备份<span class="heading-period">.</span></h1><p>让这个空间，更像你。</p></div><span class="stage-pill">V1 · 第一阶段</span></section>
    <div class="settings-grid"><section class="settings-card"><div class="settings-title">${icon('sun')}<h2>外观与首页</h2></div><p>舒服的界面，适合自己的节奏。</p><fieldset class="theme-options"><legend>主题模式</legend>${[{id:'light',label:'浅色',icon:'sun'},{id:'dark',label:'深色',icon:'moon'},{id:'system',label:'跟随系统',icon:'settings'}].map(t=>`<label class="theme-option">${icon(t.icon)}<input type="radio" name="theme" value="${t.id}" ${preferences.theme===t.id?'checked':''}>${t.label}</label>`).join('')}</fieldset><div class="setting-row"><div><strong>首页卡片</strong><small>显示、隐藏与排序，仅此浏览器生效</small></div><button class="button outline" data-action="customize">调整布局</button></div></section>
    <section class="settings-card"><div class="settings-title">${icon('shield')}<h2>数据状态</h2></div><div class="storage-status">${icon('cloud')}<div><strong>云端同步尚未启用</strong><small>当前版本仅提供界面与组件骨架</small></div></div><dl class="status-list"><div><dt>个人业务记录</dt><dd>未接入</dd></div><div><dt>主题与卡片偏好</dt><dd>${storageIssue?'存储异常 · 当前页面有效':'保存在此浏览器'}</dd></div><div><dt>真实 / 演示数据</dt><dd>空状态默认 · 演示需手动打开</dd></div><div><dt>站点发布</dt><dd>未部署 · 未公开发布</dd></div></dl></section>
    <section class="settings-card"><div class="settings-title">${icon('download')}<h2>备份与恢复</h2></div><p>现在可备份界面偏好；业务数据备份将在接入存储后开放。</p><div class="backup-actions"><button class="button outline" data-action="export">${icon('download')}导出界面偏好</button><button class="button outline" data-action="import">${icon('upload')}恢复界面偏好</button><input type="file" id="import-file" accept="application/json,.json" hidden></div><p class="small-note">JSON 文件仅含主题、卡片顺序与可见性，不含任何生活记录。</p><div class="setting-row"><div><strong>个人业务数据导出</strong><small>待接入真实数据与身份校验后开放</small></div><button class="button outline" disabled>尚未开放</button></div></section>
    <section class="settings-card"><div class="settings-title">${icon('cloud')}<h2>存储与同步方案</h2></div><p>已核对当前 Sites 技能文档与工具能力。</p><ul class="capability-list"><li><span class="capability-dot"></span><div><strong>D1 持久化数据库</strong><small>后续用于待办、消费、学习、习惯与收藏。</small></div></li><li><span class="capability-dot"></span><div><strong>ChatGPT 身份认证 + Workers</strong><small>服务端识别用户，按用户 ID 隔离记录。</small></div></li><li><span class="capability-dot"></span><div><strong>登录后跨设备读取同一份数据</strong><small>需接入 D1 并部署后验证；当前未实现同步。</small></div></li></ul><p class="small-note">本阶段未创建数据库、未验证线上鉴权或跨设备同步。浏览器偏好存储不具备跨设备能力。</p></section></div>`;
}
function render() {
  const current = modules.find(m=>m.id===route());
  $('#navigation').innerHTML = modules.filter(m=>m.id!=='settings').map(m=>`<a href="#/${m.id}" ${m.id===current?.id?'aria-current="page"':''}>${icon(m.icon)}<span>${m.label}</span>${m.id==='home'?'<span class="nav-active-dot"></span>':''}</a>`).join('');
  $('#settings-link').innerHTML = `${icon('settings')}<span>设置与数据备份</span>`;
  if(current?.id==='settings') $('#settings-link').setAttribute('aria-current','page'); else $('#settings-link').removeAttribute('aria-current');
  $('#breadcrumb-current').textContent = current?.label || '页面未找到';
  document.title = `${current?.label || '页面未找到'} · LifeHub`;
  $('#main').innerHTML = !current ? `<section class="no-cards"><h1>这里还没有页面</h1><p>试试从生活总览重新出发。</p><a class="button solid" href="#/home">返回首页</a></section>` : current.id === 'home' ? renderHome() : current.id === 'settings' ? renderSettings() : renderModule(current);
}
function openDialog(content) {
  dialogReturnFocus = document.activeElement;
  $('#app-dialog').innerHTML = `<div class="dialog-top"><span class="eyebrow">LIFEHUB</span><button class="icon-button" data-action="close-dialog" aria-label="关闭弹窗">${icon('close')}</button></div>${content}`;
  if (!$('#app-dialog').open) $('#app-dialog').showModal();
}
function closeDialog() { $('#app-dialog').close(); if(dialogReturnFocus?.isConnected) dialogReturnFocus.focus(); }
$('#app-dialog').addEventListener('click', event => { if(event.target === $('#app-dialog')) closeDialog(); });
$('#app-dialog').addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
function customization(keepFocus = null) {
  const savedReturn = dialogReturnFocus;
  openDialog(`<h2 id="dialog-title">你的首页，你来安排</h2><p class="dialog-description">选择想看见的卡片，用上下箭头调整顺序。修改立即生效，仅保存在此浏览器。</p><div class="customize-list">${preferences.order.map((id,index)=>{const card=cards.find(c=>c.id===id);return `<div class="customize-row"><label>${icon(card.icon)}<span>${card.title}</span><input type="checkbox" data-card-toggle="${id}" ${preferences.hidden.includes(id)?'':'checked'} aria-label="显示${card.title}"></label><div><button class="icon-button" data-action="move-up" data-id="${id}" aria-label="上移${card.title}" ${index===0?'disabled':''}>${icon('up')}</button><button class="icon-button" data-action="move-down" data-id="${id}" aria-label="下移${card.title}" ${index===preferences.order.length-1?'disabled':''}>${icon('down')}</button></div></div>`;}).join('')}</div><div class="dialog-footer"><button class="text-link" data-action="reset-layout">恢复默认布局</button><button class="button solid" data-action="close-dialog">完成</button></div>`);
  if(keepFocus) { dialogReturnFocus = savedReturn; const target = $('#app-dialog').querySelector(keepFocus); target?.focus(); }
}
function moduleInfo(id) {
  const m = modules.find(m=>m.id===id);
  openDialog(`<span class="module-icon compact">${icon(m.icon)}</span><h2 id="dialog-title">${m.label}，即将就绪</h2><p class="dialog-description">本阶段先完成界面骨架。新增与保存个人记录将在后续阶段开发，目前没有记录表单，也不会保存业务数据。</p><div class="dialog-footer"><button class="button outline" data-action="close-dialog">知道了</button><a href="#/${m.id}" class="button solid" data-action="close-dialog">查看模块规划${icon('arrow')}</a></div>`);
}
function quickAdd() {
  openDialog(`<h2 id="dialog-title">从一件小事开始</h2><p class="dialog-description">选择一个模块查看规划。个人记录的新增功能将在后续阶段开放。</p>${quickCard()}`);
}
function exportPreferences() {
  const blob = new Blob([JSON.stringify({ format:'lifehub-preferences',version:1,preferences },null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'lifehub-preferences-v1.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('已导出界面偏好，不包含业务记录。');
}
document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-action]');
  if(!trigger || trigger.disabled) return;
  const action = trigger.dataset.action;
  if(action==='customize') customization();
  if(action==='close-dialog') closeDialog();
  if(action==='quick-add') quickAdd();
  if(action==='module-info') moduleInfo(trigger.dataset.id);
  if(action==='retry') {viewMode='empty';render();toast('已返回空状态，真实数据服务尚未接入。');}
  if(action==='export') exportPreferences();
  if(action==='import') $('#import-file').click();
  if(action==='reset-layout') {preferences.order=cards.map(c=>c.id);preferences.hidden=[];persist();render();customization('[data-action="reset-layout"]');}
  if(action==='move-up'||action==='move-down') {
    const id=trigger.dataset.id; const index=preferences.order.indexOf(id);const target=index+(action==='move-up'?-1:1);
    if(target<0||target>=preferences.order.length)return;
    [preferences.order[index],preferences.order[target]]=[preferences.order[target],preferences.order[index]];
    persist();render();customization(`[data-action="${action}"][data-id="${id}"]`);
  }
});
document.addEventListener('change', async event => {
  const target=event.target;
  if(target.id==='view-mode') {viewMode=target.value; render(); $('#view-mode').focus();}
  if(target.name==='theme') {preferences.theme=target.value; applyTheme();persist();}
  if(target.dataset.cardToggle) {
    const id=target.dataset.cardToggle;
    preferences.hidden=target.checked?preferences.hidden.filter(x=>x!==id):[...preferences.hidden,id];persist();render();
  }
  if(target.id==='import-file'&&target.files[0]) {
    try {
      const file=target.files[0]; if(file.size>20000)throw new Error('文件过大');
      const payload=JSON.parse(await file.text());
      if(payload.format!=='lifehub-preferences'||payload.version!==1)throw new Error('版本不支持');
      const imported=validatePreferences(payload.preferences);
      openDialog(`<h2 id="dialog-title">恢复界面偏好？</h2><p class="dialog-description">这将替换此浏览器的主题、卡片顺序与显示设置，不会导入个人业务记录。</p><div class="dialog-footer"><button class="button outline" data-action="close-dialog">取消</button><button class="button solid" id="confirm-import">确认恢复</button></div>`);
      $('#confirm-import').addEventListener('click',()=>{preferences=imported;applyTheme();const saved=persist();closeDialog();render();if(saved)toast('界面偏好已恢复。');},{once:true});
    }catch{toast('无法恢复：请使用 LifeHub V1 导出的有效界面偏好 JSON 文件（小于 20 KB）。');}
    target.value='';
  }
});
$('#theme-toggle').addEventListener('click',()=>{preferences.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';applyTheme();persist();if(route()==='settings')render();});
$('#mobile-menu').innerHTML=icon('menu');
$('#mobile-menu').addEventListener('click',toggleMenu);
$('#sidebar-backdrop').addEventListener('click',closeMenu);
menuMedia.addEventListener('change',closeMenu);
$('#sidebar').addEventListener('click',event=>{if(event.target.closest('a')&&menuMedia.matches){closeMenu();$('#main').focus();}});
$('.skip').addEventListener('click',event=>{event.preventDefault();$('#main').focus();$('#main').scrollIntoView();});
document.addEventListener('keydown',event=>{
  if(!$('#sidebar').classList.contains('open'))return;
  if(event.key==='Escape'){closeMenu();$('#mobile-menu').focus();}
  if(event.key==='Tab'&&menuMedia.matches){
    const links=[...$('#sidebar').querySelectorAll('a')];
    if(event.shiftKey&&document.activeElement===links[0]){event.preventDefault();links.at(-1).focus();}
    else if(!event.shiftKey&&document.activeElement===links.at(-1)){event.preventDefault();links[0].focus();}
  }
});
window.addEventListener('hashchange',()=>{if($('#app-dialog').open)closeDialog();closeMenu();render();$('#main').focus();window.scrollTo({top:0});});
applyTheme();render();closeMenu();
if(storageIssue)toast('无法读取本机偏好，已使用默认布局。可在设置中重新保存。');
