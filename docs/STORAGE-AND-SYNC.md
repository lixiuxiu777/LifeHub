# 存储、身份与一致性（更新至第四阶段）

核对日期：2026-10-29。依据当前 Sites 1.1.2 技能、官方 Vinext starter、原生工具与实际本机 D1 测试。

## 当前实现

同一 LifeHub Site 已从静态站迁移为官方 Vinext / Cloudflare Workers 应用，清单使用 `d1: "DB"`，保留唯一 Site ID。未使用 R2，没有外部数据库或 AI API。

| 项目 | 实现 |
|---|---|
| 业务记录与首页偏好 | D1 `lifehub_records`，十类带类型的记录 |
| 统一访问层 | 客户端 DataStore → 同源 API → 服务端验证/授权 → D1 |
| 生产身份 | Sites 原生 ChatGPT 登录；使用服务端稳定 userId |
| 所有权 | owner_id 由服务端生成；所有读取、更新、删除与关联查询均校验 owner |
| 本机开发 | 官方 loopback-only 模拟登录 + Miniflare D1，`.wrangler/state` 保存 |
| 跨设备 | 仅真实私有部署的同一站点、同一 ChatGPT 账户共享 D1；本机库不跨设备 |
| 浏览器存储 | 不保存业务记录与新偏好；只读取旧版 localStorage 布局供用户选择迁移 |
| 文件与备份 | 用户主动下载 JSON；不写入源码、公共静态资源、公共存储或日志 |

本机已完成真实 Miniflare D1 读写与恢复测试。私有部署、生产鉴权和真实不同设备的验证状态应以最终交付回执为准；本机测试不能充当生产同步测试。

## 数据模型

每条记录统一包络：`id` UUID、`type`、`createdAt`、`updatedAt`、`version`、`data`。数据库额外保存不可由客户端指定的 owner_id 与关联 parent_id。

| 模型 | 业务字段 |
|---|---|
| Task | title, description, dueDate, timeZone, priority, status, category, tags, parentTaskId, recurrence, seriesId, occurrenceDate, occurrenceIndex |
| CalendarEvent | title, allDay, startAt/endAt 或 startDate/endDate, timeZone, taskId, note |
| Expense | title, direction（income/expense）, amountMinor, currency, date, category, paymentMethod, merchant, tags, note |
| Budget | month, amountMinor, currency, scope（total/category）, category（总预算为 null）, note |
| LearningGoal | title, targetMinutes, status, note |
| StudySession | title, goalId（可选）, date, minutes, note |
| Habit | title, note |
| HabitCheckIn | habitId, date, note |
| Bookmark | title, url, tags, note |
| DashboardPreference | theme, order, hidden, defaultView, dateFormat, timeFormat, timeZone |

学习记录可关联自己的学习目标，打卡必须关联自己的习惯。外键限制删除仍有子记录的目标/习惯；每用户仅一份 DashboardPreference，同习惯同日只能打卡一次。同币种同月仅一份总预算、每分类仅一份分类预算。模型严格验证，未知字段、浮点最小货币单位、无效日期、危险链接均拒绝。

当前采用带类型 JSON 记录表，统一 metadata / owner 索引，适合此阶段的统一管理。后续数据量增长时可按领域增加专门查询、日期索引、分页和聚合 API；不改变现有记录身份与所有权。

第三阶段额外使用私有 `lifehub_operations` 保存最近一步待办/日程撤销快照与请求去重凭据。关联、重复实例、全天结束边界和持久化单步撤销的完整规则见 [待办与日程规则](TASKS-AND-CALENDAR.md)。

第四阶段迁移 0002 新增 `lifehub_finance_receipts`，仅保存 operationId、owner、请求摘要、结果 ID 与时间，无记录正文；同请求重试不重复记账。财务增删改使用 revision 守卫和 D1 原子 batch，读取与写入竞争时回滚并提示刷新。不会清除待办/日程的最近撤销记录。旧消费兼容为支出，旧预算兼容为总预算，无用户数据迁移或 seed。

财务导出在服务器重新读取当前身份的记录，按所选月份与单一币种生成。使用鉴权、同源 POST 与 private/no-store；搜索、备注、商家不进入 URL。文件只通过响应下载，服务端不保存公共副本。详细精度与导出规则见 [收支与预算](FINANCE.md)。

## 金额与时间

- amountMinor 为正整数，单笔上限 10^12 最小单位；CNY/USD/EUR 精度 2、JPY 精度 0、KWD 精度 3。
- 输入先按十进制字符串解析为 BigInt，再验证范围转安全整数；不使用浮点解析相加。
- 汇总采用 BigInt，显示通过 Intl 的整数格式部件与精确小数拼接；不同货币不混合，没有隐含汇率。
- 时间点保存 ISO UTC；日程保留 IANA 时区。按用户时区计算今日与近期范围，包含跨午夜的持续事件。
- 截止日、消费日、学习日、打卡日使用有效 YYYY-MM-DD 日期。日程墙上时间输入按所选时区转换，拒绝夏令时跳过/重复时段。

## 一致性与同步

首页所有指标来自同一 DataStore 中服务器返回的记录：今日未完成任务、未来七日的日程、本月每币种支出/预算、目标关联学习分钟、本月学习时长、本周有打卡的天数、最近收藏。空数据库展示真实零值与空状态；未加载成功时不显示零值。

写入成功才更新本机内存；不在联网失败时伪称已保存。进入页面、恢复窗口焦点、手动刷新会重取。无实时推送或离线队列。API 的版本条件更新避免覆盖其他页面的修改，409 时要求刷新核对。

完整备份恢复在 D1 batch 事务中执行。每次增删改由数据库触发器更新用户 revision，恢复前比较预览 stateKey，并在事务内核对 revision，防止恢复预览后或恢复过程中并发写入被覆盖。任何模型、外键、唯一性或 revision 错误均回滚。

## 安全边界

生产身份头仅信任 Sites 托管边界，使用官方 `getChatGPTUser()`；匿名 API 返回 401。输入的 ownerId 会被拒绝，不允许客户端指定所有权。官方本机 mock 会剥离自带身份头，只有本机 cookie 可建立开发模拟身份；开发模拟认证不进入生产构建。

写操作验证 Origin 与 JSON 类型。API 响应 private/no-store；Worker 设置 no-sniff/no-referrer。渲染用户文本时 HTML 转义；收藏 URL 仅允许无嵌入凭据的 http/https。业务层不记录记录正文、金额、身份头或凭据；不在请求处理中建表。

迁移由 Drizzle 生成后审核；初次生成的 JSON 表达式索引 SQL 已在应用前修正，并在 SQLite 与本机 D1 验证。迁移包括 schema、索引、revision 触发器，不包含任何用户 seed。

## 限制与替代方案

本机开发库与线上 D1 完全分离，不自动上传测试记录。真正跨设备须使用已部署的私有站点及同一账户；不同 Site 或不同 ChatGPT 账户拥有不同身份空间。

恢复上限 1000 条 / 2 MB，恢复时替换该账户全部数据，先导出备份。没有文件附件、定时提醒、实时推送或离线冲突合并。若托管权限导致生产 D1/身份不可用，应明确报告未启用云端同步，并保持本机开发库标识；不得静默改用 localStorage 宣称云同步。
