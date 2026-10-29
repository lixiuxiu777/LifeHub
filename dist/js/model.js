export const modules = [
  { id: 'home', label: '首页仪表盘', icon: 'home', subtitle: '把生活的每一面，放在一起。' },
  { id: 'tasks', label: '待办与日程', icon: 'tasks', subtitle: '让重要的事，有时间也有着落。', features: ['待办清单与优先级', '日期与日程视图', '完成状态与提醒入口'] },
  { id: 'expenses', label: '消费记录', icon: 'wallet', subtitle: '看见每一笔支出，照顾未来的自己。', features: ['收支与分类记录', '月度消费汇总', '筛选与明细导出'] },
  { id: 'learning', label: '学习成长', icon: 'learn', subtitle: '让每一点好奇，都慢慢有回响。', features: ['学习目标与计划', '进度与学习时长', '阶段复盘'] },
  { id: 'habits', label: '习惯追踪', icon: 'habit', subtitle: '一点点坚持，长成喜欢的日常。', features: ['自定义生活习惯', '每日打卡', '连续记录与趋势'] },
  { id: 'collections', label: '生活收藏', icon: 'bookmark', subtitle: '为灵感和喜欢的事，留一个位置。', features: ['链接与笔记收藏', '标签与分类', '搜索与整理'] },
  { id: 'settings', label: '设置与数据备份', icon: 'settings', subtitle: '让这个空间，更像你。' },
];
export const cards = [
  { id: 'tasks', title: '今日待办', icon: 'tasks', color: 'green', route: 'tasks', empty: '为今天留下一件重要的事', description: '待办模块接入后，今日任务会出现在这里。', action: '了解待办模块' },
  { id: 'schedule', title: '今日及近期日程', icon: 'calendar', color: 'blue', route: 'tasks', empty: '给生活一点从容的安排', description: '未来 7 天的安排，将在这里清晰展开。', action: '了解日程模块' },
  { id: 'expenses', title: '本月消费摘要', icon: 'wallet', color: 'orange', route: 'expenses', empty: '每一笔，都值得被看见', description: '接入消费记录后，查看本月支出与分类。', action: '了解消费模块' },
  { id: 'learning', title: '学习进度', icon: 'learn', color: 'purple', route: 'learning', empty: '下一次成长，从好奇开始', description: '你的学习计划与进度，将在这里汇聚。', action: '了解学习模块' },
  { id: 'habits', title: '习惯打卡', icon: 'habit', color: 'green', route: 'habits', empty: '小小的坚持，也有力量', description: '习惯模块接入后，在这里记录每日进步。', action: '了解习惯模块' },
  { id: 'collections', title: '最近收藏', icon: 'bookmark', color: 'rose', route: 'collections', empty: '把喜欢的灵感，留在身边', description: '收藏的文章、链接和灵感，将在这里相遇。', action: '了解收藏模块' },
  { id: 'quick', title: '快速新增', icon: 'plus', color: 'green' },
];
export const defaultPreferences = () => ({ theme: 'system', order: cards.map(c => c.id), hidden: [] });
export const STORAGE_KEY = 'lifehub.preferences.v1';
export function validatePreferences(value) {
  if (!value || typeof value !== 'object' || !['system', 'light', 'dark'].includes(value.theme)) throw new Error('偏好格式不正确');
  const ids = cards.map(c => c.id);
  if (!Array.isArray(value.order) || value.order.length !== ids.length || new Set(value.order).size !== ids.length || value.order.some(id => !ids.includes(id))) throw new Error('卡片顺序不正确');
  if (!Array.isArray(value.hidden) || new Set(value.hidden).size !== value.hidden.length || value.hidden.some(id => !ids.includes(id))) throw new Error('隐藏卡片格式不正确');
  return { theme: value.theme, order: [...value.order], hidden: [...value.hidden] };
}
// This adapter deliberately returns no records; no business storage exists in phase 1.
// Future authenticated HTTP/D1 adapter must return this shape without demo fixtures.
export const emptyDashboard = Object.freeze({ tasks: [], schedule: [], expenses: [], learning: [], habits: [], collections: [] });
