# 当前 Sites 运行能力与数据方案

核对日期：2026-10-29。范围：当前安装的 Sites 1.1.2 技能、官方模板、工具契约与本次注册项目的返回状态。

## 核对结果

| 能力 | 当前环境支持情况 | 本阶段实际状态 |
|---|---|---|
| 静态站点 | 支持 HTML/CSS/JS 静态托管 | 已完成本机实现与预览，静态目录 dist |
| 服务端逻辑 | 支持 Cloudflare Workers；提供 Vinext starter | 本阶段静态站没有服务端业务逻辑 |
| 持久化数据库 | 支持 Cloudflare D1，通过 manifest 逻辑绑定配置 | 未绑定、未建表、无真实业务数据 |
| 文件存储 | 支持 Cloudflare R2，服务端访问 | 未使用；后续有附件需求再启用 |
| 身份验证 | Sites 平台提供 Sign in with ChatGPT 与服务端身份头 | 尚未集成业务鉴权，未验证线上登录 |
| 访问控制 | Sites 原生访问策略，默认新站私有 | 已注册，返回 access_mode=custom；未扩大访问范围 |
| 跨设备同步 | 可用同一 Sites 身份 + Workers API + D1 实现 | **尚未实现/验证**；不能因平台具备能力就宣称已经同步 |
| 后台提醒、实时推送、离线冲突合并 | 不从上述能力推断自动支持 | 不在本阶段实现 |

注册结果确认：项目状态 active，live URL 为 null；初始版本数为 0。此处 active 仅代表项目注册状态，不代表网站已经部署。保存源代码或版本也不等于发布。线上 D1、鉴权与同步需要部署后独立验收。

## 能力依据

以下均为本机安装的 Sites 插件资料（从插件根目录起的相对路径）：

- `skills/sites/SKILL.md`：静态站与 Vinext 工作流；Workers 服务端，128 MB isolate、HTTP 外联、不支持原始 TCP。
- `skills/sites/references/storage.md`：D1 / R2 逻辑绑定、schema、迁移、local 与 hosted 数据库分离。
- `skills/sites/references/identity-and-secrets.md`：平台身份头、服务端认证、私有站点、密钥处理。
- `skills/sites/templates/vinext-starter/package.json`：React 19、Vinext/Vite、Cloudflare 插件、Drizzle ORM。
- 原生 `create_site` / `get_site` / `save_site_version` 工具：注册、访问状态与不部署保存。

未申请 API Key、未创建绕过登录 token、未更改访问策略。上述支持结论来自当前工具和模板；没有进行生产数据库写入探测。

## 推荐架构（下一阶段实施）

```text
用户浏览器（桌面 / 手机）
  → Sites 访问控制与 ChatGPT 登录
  → Workers / Vinext API（校验身份、授权、参数）
  → D1：用户隔离的业务记录与云端偏好
  → R2：可选私有附件，仅经授权接口读写
```

不需要外部服务器或 Docker。使用官方 starter 保留 `sites()` 构建集成。切换服务端时移除当前 `static` 配置、显式声明 D1 `DB` 绑定，按官方 helper 构建；未使用的 R2 绑定保持 null，不提前创建资源。迁移通过 Drizzle 生成并审核后提交；不在请求处理中创建/改表。

### 身份与访问隔离

Sites 平台提供 `oai-authenticated-user-id`、email 等身份头。通过官方服务端 `getChatGPTUser()` 获取 ID，API 缺少身份返回 401，每次操作再次鉴权；页面可使用 `requireChatGPTUser()`。身份页面禁用静态共享缓存。

使用站点内稳定的用户 ID 作为 `owner_id`。客户端不得提交并决定 owner_id；所有查询、更新、删除必须包含服务端身份对应的 owner 条件。email 只作可选显示字段，不作所有权主键。登录和退出使用平台顶层导航，不自行实现 OAuth 或模拟登录。上述身份头只在 Sites 可信部署边界使用，不把本地请求里随意传入的头当可信身份。

个人模式保持站点所有者私有。未来引入多个使用者时，仍需数据行级授权，站点访问许可不能替代业务数据隔离。API 响应使用 private/no-store；可变更请求校验 Origin / CSRF、防止跨站写入。

### 数据模型草案

不在本阶段创建表，以下为规划：

| 实体 | 关键字段 |
|---|---|
| tasks | id, owner_id, title, status, priority, due_date, version, timestamps |
| events | id, owner_id, title, start_at, end_at, timezone, version, timestamps |
| expenses | id, owner_id, amount_minor, currency, category_id, spent_on, note, version, timestamps |
| learning_plans | id, owner_id, title, target, progress, version, timestamps |
| habits | id, owner_id, title, frequency, timezone, version, timestamps |
| habit_checkins | id, owner_id, habit_id, local_date, timestamps |
| collections | id, owner_id, title, url, note, tags, version, timestamps |
| dashboard_preferences | owner_id, schema_version, theme, order_json, hidden_json, version, timestamps |

金额用最小币种单位整数存储，禁止浮点累计；显示时按币种格式化。时间点存 UTC，事件保留时区；整日待办与打卡保留本地日期，避免跨时区错日。habit_checkins 为 `(owner_id, habit_id, local_date)` 建唯一约束。为 owner_id 与常用日期查询建联合索引。所有枚举、文本长度、日期与金额范围均由服务端校验。

### 同步策略

第一版采用在线读写：写入服务端成功后再显示成功；进入页面、窗口重新获得焦点或点击刷新时重新获取。两台设备用同一站点登录身份读取同一份 D1 数据，即可形成跨设备持久化。它不等于实时推送或离线自动合并。

更新携带 `version`，服务端条件更新；冲突返回 409，要求重新加载并核对，不静默覆盖。写入失败明确显示错误与重试，不能弹出假成功。下一阶段需要以真实部署完成：匿名请求拒绝、用户 A/B 隔离、写入后刷新仍在、另一台设备可读、并发冲突与失败重试测试。

本机主题/布局偏好可继续用 localStorage 作缓存；登录后以云端偏好为持久化来源。首登迁移应显式提示，由用户选择是否采用本机布局，避免无声覆盖。

## 备份、安全与替代方案

目前只能导出/恢复界面偏好，无业务记录。后续提供经鉴权的 JSON/CSV 导出，含格式版本、导出时间、币种/时区和记录 ID；恢复先校验、显示数量、确认后执行。备份可能含敏感信息，按用户操作下载到本机，不放入 GitHub、dist、公共 R2 URL 或日志。

生产 API 不记录记录正文、消费金额、身份头、token；错误日志只保留必要错误码与请求标识。数据库迁移只提交 schema，不包含个人 seed。GitHub 仅用于代码版本管理，不承担个人数据备份。

如果后续账号的托管权限或部署条件使 D1/身份能力不可用，必须停止宣称云端同步：可先采用 IndexedDB 保存本机记录并由用户导出/导入迁移，明确标注“仅此设备”；或由用户下一步选择托管数据库并配置服务端认证。禁止用 localStorage 冒充云端数据库，禁止未经用户决定将敏感记录发送到外部服务。
