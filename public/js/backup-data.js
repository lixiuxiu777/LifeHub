export const backupScopes={
  all:{label:'全部记录与首页配置',types:['Task','CalendarEvent','Expense','Budget','LearningGoal','StudySession','Habit','HabitCheckIn','Bookmark','DashboardPreference']},
  tasks:{label:'待办与日程',types:['Task','CalendarEvent']},
  expenses:{label:'消费与预算',types:['Expense','Budget']},
  learning:{label:'学习成长',types:['LearningGoal','StudySession']},
  habits:{label:'习惯与完整打卡历史',types:['Habit','HabitCheckIn']},
  collections:{label:'生活收藏',types:['Bookmark']},
  preferences:{label:'首页与显示配置',types:['DashboardPreference']},
};
export const canonical=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));return value;}
