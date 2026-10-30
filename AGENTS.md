# LifeHub 工作约定

- 当前为 V1 第六阶段：身份隔离、版本轮询、提交回执、安全分范围备份与整体数据验收。保留前五阶段功能。
- 本阶段用户明确要求未经确认不得正式发布：仅保存版本与推送代码，不部署或更新生产，不扩大 Sites 访问范围。
- 每阶段验证完成后，将代码推送到 https://github.com/lixiuxiu777/LifeHub.git 。禁止推送个人记录、备份、凭证、运行时数据库。
- `.openai/hosting.json` 的 project_id 必须沿用；不要重复创建 Site。
- 个人记录和首页偏好均经服务端鉴权写入 D1。浏览器只读取旧版布局供显式迁移，不作为持久化数据源。
- 演示数据与真实数据必须始终明确区分，不自动填充演示数据。
- 创建或使用的 `.test.mjs` 文件验证完立即删除，交付与提交前再次检查。不保留引用已删除文件的可执行测试命令。
- 无 AI API、无 API Key。使用系统字体与本地资源，避免外部追踪。
- 原生私有部署保持 owner-only；公开发布或扩大访问范围需要用户明确要求。
- 修改 lib/domain.ts 时同步检查客户端表单与选择器；数据库迁移不可修改已应用历史。
- 重复任务在服务器事务中一次生成独立实例；不要在读取、刷新或完成任务时重复生成。保留已完成历史。
- Task / CalendarEvent 写入必须走 planner-service 事务、operationId 去重和撤销记录，不能绕过所有权、版本和 revision 检查。
- 全天事件 endDate 不包含结束日期，界面结束日期包含当天。定时事件存 UTC，任务截止日按任务自身时区解释。
- Expense / Budget 写入走 finance-service 的 revision 事务、operationId 去重、所有权和版本校验。收入与支出均存正整数最小单位，用 direction 区分；禁止跨币种累加或用收入冲抵预算支出。
- 财务汇总和导出共用 finance-data。明细筛选不改变整月摘要/预算/图表；月度 JSON 不是完整恢复备份。导出用同源鉴权 POST，避免搜索和商家出现在 URL 日志中。
- LearningGoal / StudySession / Habit / HabitCheckIn / Bookmark 写入走 life-service 的 revision 事务与 operationId 去重；时长仅由独立 StudySession 计算，不能把阶段/目标预估时间计入实际学习。
- 打卡撤销必须保留同一日期记录及追加 history；不可直接删除打卡历史。有打卡的习惯应归档。规则修改从下周一生效，保留 scheduleHistory。恢复备份不得丢失现有打卡或改写历史规则。
- 外链仅允许无嵌入凭据的 http/https，使用新标签、noopener/noreferrer，不自动抓取网页或外部图片。收藏导出按当前身份与筛选生成，禁止写入公共资源。
