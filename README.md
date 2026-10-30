# LifeHub

生活，有序生长。个人生活仪表盘，V1 第六阶段：数据隔离、同步与安全备份。

## 本阶段状态

代码与本机验收已完成，保持现有 Site 和 owner-only 权限。**本阶段未经确认不部署：线上仍为第五阶段，本阶段仅保存待审版本并推送 GitHub。** 手机浏览器与真实不同设备的端到端验收仍待完成，详见 [本阶段交付与验收](docs/PHASE6-ACCEPTANCE.md)。

## 已实现

- 学习：带期限的目标、最多 30 个学习阶段、目标/阶段归属、真实时长、学习笔记、资料链接、完成进度与可筛选的历史记录。请求重试不重复计时。
- 习惯：每天或每周目标、计划日与固定休息日、独立时区、月历、补记、备注、撤销与完整变更历史；连续计划日、周/月完成率、归档/恢复。规则调整从下周一生效，历史计划保留。
- 收藏：标题/URL、分类、标签、个人笔记、组合搜索筛选、CSV/JSON 清单导出；外链安全打开。完整规则见 [成长与日常](docs/GROWTH-HABITS-BOOKMARKS.md)。

- 收入/支出：金额、币种、账务日期、自定义分类、支付方式、商家、标签、备注；编辑、删除确认、全文搜索和日期/分类/收支/支付方式组合筛选。
- 每月总预算及分类预算，按月与币种查看已支出、剩余及使用率，超支提示；收入不抵扣支出，分类预算不与总预算重复累加。
- 真实分类支出图和最近六个月收入/支出趋势，准确数值表；历史月份切换。空数据库无示例记录。
- 同源服务端生成筛选明细 CSV、整月预算 CSV、整月 JSON；金额精确输出、UTF-8 BOM、CSV 引号及公式注入防护。完整 JSON 备份仍在设置中。详见 [收支与预算规则](docs/FINANCE.md)。

- 待办：标题、描述、四档优先级、截止日期、任务时区、待办/进行中/已完成，分类、标签、搜索与组合筛选；今日、未来七天、全部任务视图。
- 重复任务：按天/周/月及间隔，一次生成 2–60 个独立实例。每个实例有单独 ID、状态与历史；月末缺失日期取当月末日，后续仍按原始日期计算。完成或刷新不重复生成。
- 子任务：最多五层，禁止循环；父子状态独立。删除父任务保留子任务并提升为顶层，关联日程保留并解除链接。
- 日程：指定时间/全天、多日事件、月历与当天明细、关联任务、即将到期和逾期提示。
- 删除确认与持久化单步撤销；刷新后可撤销最近一次待办/日程新增、编辑、状态修改、删除或整批重复生成。并发变化时拒绝不安全撤销。

- 十类统一模型：Task、CalendarEvent、Expense、Budget、LearningGoal、StudySession、Habit、HabitCheckIn、Bookmark、DashboardPreference。
- 每条记录有服务端 UUID、创建/更新时间与并发版本号；用户所有权由 ChatGPT 服务端身份决定。
- 六类快速新增：待办、日程、消费、学习记录、习惯打卡、收藏。模块页可维护学习目标、习惯和预算，并编辑/删除记录。
- 首页摘要从同一份真实记录计算；增删改成功后更新。不默认加入演示数据。
- 卡片显示/隐藏/排序、默认视图、日期/时间格式、显示时区、主题与恢复默认布局，均保存在 D1。
- 完整 / 单模块 / 首页配置 JSON 备份；服务端格式验证、范围与冲突预览、明确确认、原子恢复与失败回滚。默认只添加新记录，不静默覆盖。
- 桌面侧栏与手机导航；空状态、真实加载状态、错误/冲突提示。

无 AI API、无 API Key、无第三方追踪。代码仓库仅存放代码和数据库结构，禁止提交个人记录、备份、凭据或运行时数据库。

## 运行与构建

Node.js >=22.13，使用 Sites 官方 Vinext / React / Vite / Cloudflare Workers starter。无需 Docker 或外部服务器。

```sh
npm ci --prefer-offline --no-audit --no-fund
npm run build
```

新克隆目录第一次启动 D1 本机数据库前，应用尚未执行的迁移（不要重复执行已应用 SQL）：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_new_talkback.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_superb_mathemanic.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_nasty_firelord.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_volatile_hawkeye.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_mixed_tempest.sql
npm run dev -- --hostname 127.0.0.1 --port 4173
```

打开 http://127.0.0.1:4173 ，点击“使用 ChatGPT 登录”。本机开发使用官方 starter 的模拟用户 `local_seedy`，界面明确标注本机开发库。**它不是真实云端登录，也不跨设备同步。** 本机持久化在忽略提交的 `.wrangler/state/`；服务重启后继续读取。

```sh
npm run check
```

执行客户端语法检查、TypeScript 检查与 Sites ID / D1 清单校验。Sites 工作流构建应使用插件 `build-site.mjs`，保留官方 `sites()` 集成。

## 云端与身份

继续使用同一 Site ID：`appgprj_6ae2c732d5248191b59f80e856446929`。清单的 `d1: "DB"` 绑定由 Sites 在部署时创建/连接；服务端数据与本机开发库彼此独立。

私有部署使用 Sites 原生 ChatGPT 登录。API 缺少身份返回 401，写入校验同源 Origin，所有 SQL 按服务端 owner_id 过滤。跨设备使用**同一站点、同一 ChatGPT 账户**，共享同一 D1 数据。没有公开个人数据的业务接口，不将浏览器保存描述为云同步。

前台约每 15 秒检查服务器 revision，变化时重读；重新获得焦点或联网时检查，失败退避到 30 / 60 秒。后台暂停；编辑时提示远端变化并保留草稿，关闭弹窗后读取。没有实时推送、离线写入或自动冲突合并。写入使用 UUID 回执去重；超时不宣称成功。身份变化清除内存和表单，丢弃旧响应；版本冲突返回 409，需核对。完整方案见 [存储与同步](docs/STORAGE-AND-SYNC.md)。

## 金额、时间与备份

金额使用最小币种单位整数：CNY/USD/EUR 两位、JPY 零位、KWD 三位；拒绝额外小数与科学计数法。汇总采用 BigInt，按币种分别显示，不自动换汇。日程保存 UTC 时间点与时区；整日待办、消费、学习、打卡使用日期字符串。夏令时重复或不存在的输入要求修正。

备份格式 `lifehub-backup` version 3，以 scope 声明全部 / 待办日程 / 消费预算 / 学习 / 习惯 / 收藏 / 首页配置；兼容 V2 完整备份。不包含 owner_id、登录凭据、站点权限或操作回执。最多 1000 条 / 2 MB；导出过大时要求缩小范围，不生成无法导入的文件。默认合并仅新增，内容冲突阻止执行；替换须核对并明确确认，只作用于文件范围。服务端预览绑定账户、内容摘要和 revision，10 分钟有效；确认时再次检查并原子执行，同一方案重试不重复应用。ID 与创建时间保留，替换刷新版本；历史冲突或并发变化不会覆盖数据。备份为未加密 JSON，请安全保管。详见 [备份恢复说明](docs/PHASE6-ACCEPTANCE.md)。

第五阶段起，恢复还会保护现有打卡及其变更/规则历史；缺少完整历史的旧备份会被拒绝，请使用最新备份。已有打卡的习惯通过归档保留历史，打卡撤销不物理删除。

第一阶段 localStorage 只作为旧布局显式迁移来源，不自动覆盖数据库配置。当前记录与新偏好均不写入 localStorage。

## 结构

```text
app/                    受身份保护的页面与 records / restore API
lib/domain.ts           十类模型、字段验证、关联与备份规则
lib/auth-service.ts     身份/来源/数据空间校验及安全错误
lib/state-service.ts    一致的记录/revision/撤销快照
lib/records-service.ts  必需操作 ID、业务写入路由
lib/backup-service.ts   分范围导出、服务端预览与原子恢复
lib/planner-service.ts  待办/日程事务、重复生成、单步撤销与请求去重
lib/finance-service.ts  收支/预算事务、版本和请求去重
lib/life-service.ts     学习/习惯/收藏事务、历史保护与请求去重
app/api/finance/export  按身份隔离的财务导出
db/schema.ts            D1 / Drizzle schema
drizzle/                已审核的 schema 迁移和元数据
public/js/store.js      客户端数据访问、去重重试和账户切换保护
public/js/sync.js       前台版本轮询与失败退避
public/js/selectors.js  真实首页统计
public/js/forms.js      统一新增/编辑表单
public/js/views.js      首页、列表与设置
public/js/money.js      精确金额解析与显示
public/js/time.js       时区与格式处理
public/js/planner-*.js  任务/日历视图、表单与纯数据规则
public/js/finance-*.js  财务视图、表单、纯统计及导出规则
public/js/life-*.js     学习、习惯、收藏视图、表单与纯统计/导出
public/life.css         三模块的响应式样式
public/styles.css      保留第一阶段设计系统并扩展表单
worker/                 官方 Workers 入口
```

`dist` 从第二阶段起为忽略提交的构建产物；原静态源已迁移到 `public`。已有布局和 Site 身份保留。源代码持续推送至 https://github.com/lixiuxiu777/LifeHub.git 。

[验证记录](docs/VALIDATION.md) · [设计规范](docs/DESIGN.md)
