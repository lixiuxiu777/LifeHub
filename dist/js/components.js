import { icon } from './icons.js';
import { modules } from './model.js';

export const badge = '<span class="demo-badge">演示</span>';
export function heroArt() {
  return `<svg class="hero-art" viewBox="0 0 370 220" fill="none" aria-hidden="true"><circle cx="227" cy="112" r="95" stroke="currentColor" stroke-opacity=".13"/><circle cx="227" cy="112" r="68" stroke="currentColor" stroke-opacity=".1"/><path d="M125 182h198" stroke="currentColor" stroke-opacity=".2"/><path d="M225 181V88m0 59c-30 0-50-18-50-42 29-2 50 18 50 42Zm0-26c0-31 21-51 48-51 1 28-17 51-48 51Z" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2"/><path d="m197 182-6-27h67l-6 27" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2"/><rect x="106" y="53" width="67" height="73" rx="12" fill="var(--surface)" transform="rotate(-10 106 53)"/><path d="m124 73 5 4 9-12m-14 25 5 4 9-12m7-11 12-2m-12 19 12-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="302" cy="47" r="21" fill="var(--hero-sun)"/><path d="M302 15v-5m0 74v-5m32-32h5m-74 0h5m55-23 4-4m-50 50-4 4" stroke="var(--hero-sun)" stroke-width="2"/><path d="m291 155 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill="currentColor" fill-opacity=".3"/><circle cx="167" cy="161" r="3" fill="currentColor" fill-opacity=".4"/><path d="M159 27v10m-5-5h10" stroke="currentColor" stroke-opacity=".5" stroke-width="2"/></svg>`;
}

export function emptyCard(card) {
  return `<div class="empty-state"><div class="empty-icon ${card.color}">${icon(card.icon)}</div><h3>${card.empty}</h3><p>${card.description}</p><a class="text-link" href="#/${card.route}">${card.action}${icon('arrow')}</a></div>`;
}

export function loadingCard() {
  return '<div class="loading-state" role="status"><div class="skeleton short"></div><div class="skeleton"></div><div class="skeleton"></div><span>加载状态预览 · 未发起数据请求</span></div>';
}
export function errorCard() {
  return `<div class="empty-state error-state">${icon('cloud')}<h3>暂时无法加载</h3><p>这是错误状态预览，没有连接真实数据服务。</p><button class="text-link" data-action="retry">${icon('refresh')}重试并返回空状态</button></div>`;
}
export function quickCard() {
  return `<p class="quick-note">想记录的每一件小事，都有自己的位置。</p><div class="quick-grid">${modules.filter(m => !['home', 'settings'].includes(m.id)).map(m => `<button class="quick-item" data-action="module-info" data-id="${m.id}">${icon(m.icon)}<span>${({tasks:'新建待办 / 日程',expenses:'记一笔消费',learning:'添加学习计划',habits:'养成一个习惯',collections:'收藏一份灵感'})[m.id]}</span>${icon('plus')}</button>`).join('')}</div><p class="card-footnote">入口预览 · 业务记录功能将在后续阶段开放</p>`;
}

// Explicitly synthetic examples. Never used by the empty/real dashboard adapter.
export function demoCard(id) {
  const demos = {
    tasks: `<div class="demo-rows"><div class="task-row"><span class="fake-checkbox"></span><div>梳理这周的小目标<small>个人规划 <span class="priority">重要</span></small></div><span class="muted">今天</span></div><div class="task-row"><span class="fake-checkbox"></span><div>读完一本书的第一章<small>学习成长</small></div><span class="muted">今天</span></div><div class="task-row completed"><span class="fake-checkbox checked">${icon('check')}</span><div>给自己准备一份早餐<small>日常生活</small></div></div></div><div class="demo-footer">已完成 1 / 3 项 <span>仅展示样式</span></div>`,
    schedule: `<div class="agenda"><div class="agenda-item"><span class="agenda-time">10:00<small>今天</small></span><div><strong>留一段专注的时间</strong><p>个人安排 · 60 分钟</p></div></div><div class="agenda-item blue-line"><span class="agenda-time">15:30<small>明天</small></span><div><strong>周末散步计划</strong><p>生活日常 · 30 分钟</p></div></div></div><div class="demo-footer">未来 7 天 · 2 个示例日程</div>`,
    expenses: `<div class="spend-summary"><div><small>本月示例支出</small><p><span>¥</span> 1,280<span>.00</span></p></div><span class="category-chip">3 个分类</span></div><div class="demo-chart" aria-label="演示消费柱状图，无真实数据">${Array.from({length:14},() => '<i></i>').join('')}</div><div class="chart-labels"><span>月初</span><span>月中</span><span>月末</span></div><div class="demo-footer">餐饮 ¥680 · 交通 ¥200 · 生活 ¥400</div>`,
    learning: `<div class="learning-row"><span class="book-cover">读<br>书</span><div><strong>每月读一本书</strong><small>示例学习计划</small></div><span class="progress-label">40%</span></div><progress class="learning-progress" value="40" max="100" aria-label="示例学习进度 40%"></progress><div class="learning-meta"><span>已读 4 / 10 章</span><span>慢一点，也在向前</span></div><div class="demo-footer">学习记录将在后续阶段接入</div>`,
    habits: `<div class="habit-example"><div><span class="habit-symbol">${icon('habit')}</span><span>每天散步 20 分钟<small>示例习惯 · 本周 4 / 7 天</small></span></div><div class="week-checks">${['一','二','三','四','五','六','日'].map((d,i)=>`<span><small>${d}</small><i class="${i<4?'done':''}">${i<4?icon('check'):''}</i></span>`).join('')}</div></div><div class="demo-footer">打卡交互将在后续阶段开放</div>`,
    collections: `<div class="collection-row"><span class="collection-cover green">${icon('bookmark')}</span><div><strong>关于慢生活的一些灵感</strong><small>示例文章 · 生活方式</small></div>${icon('arrow')}</div><div class="collection-row"><span class="collection-cover purple">${icon('learn')}</span><div><strong>建立自己的阅读清单</strong><small>示例笔记 · 学习成长</small></div>${icon('arrow')}</div><div class="demo-footer">2 条演示收藏 · 无外部链接</div>`,
  };
  return demos[id] || '';
}
