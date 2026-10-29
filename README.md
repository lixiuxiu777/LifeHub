# LifeHub

生活，有序生长。个人生活仪表盘，V1 第一阶段。

## 本阶段交付

- 七个导航入口：首页、待办与日程、消费、学习、习惯、收藏、设置。
- 首页七张可配置卡片：待办、近期日程、消费摘要、学习、习惯、收藏、快速新增。
- 浅色 / 深色 / 跟随系统，桌面侧栏、手机抽屉导航，键盘操作与模态弹窗。
- 卡片显示、隐藏、上下排序；刷新后保留本机偏好。
- 默认空状态；显式演示、加载、错误预览，演示不写入任何记录。
- 界面偏好 JSON 导出、格式校验与确认后恢复。

**没有实现业务记录 CRUD、提醒、真实打卡、云端登录或同步。** 业务模块入口明确显示后续开发范围，不提供假保存。默认首页的破折号表示“未接入”，不表示消费为零。

## 本地运行

需要 Node.js 22+，无需安装依赖、无需 Docker、无需 API Key。

```sh
npm run dev
```

打开 http://127.0.0.1:4173 。预览服务仅绑定本机回环地址。关闭终端或按 Ctrl+C 停止。

```sh
npm run check
```

检查 JS 语法、HTML 本地资源引用和 Sites 托管清单。

## 项目结构

```text
.openai/hosting.json      已注册的 Sites 项目，静态入口 dist
dist/index.html          应用外壳、导航、弹窗容器
dist/styles.css          设计令牌、组件、主题与响应式布局
dist/js/model.js         模块/卡片定义、偏好验证、空数据契约
dist/js/components.js    空状态/演示/加载/错误卡片
dist/js/app.js           哈希导航、主题、布局配置、备份恢复
dist/js/icons.js         本地 SVG 图标
scripts/serve.mjs        仅本机的静态预览服务
scripts/check.mjs        可重复执行的静态检查
docs/                    运行能力、设计规范、验证记录
```

本阶段采用 Sites 支持的无构建 HTML/CSS/ES Modules，减少初期依赖；`dist` 是当前源文件目录，不是自动生成的构建产物。后续服务端阶段应迁移到官方 Vinext starter，沿用 Site ID、设计令牌与组件契约，使用 Sites 官方构建集成。

## 数据与隐私

localStorage 中只有 `lifehub.preferences.v1`（主题、卡片顺序、隐藏列表），**不是跨设备数据库**。演示预览仅驻留内存，刷新后回到空状态。页面无 AI API、分析追踪、第三方字体或外部图片请求。不采集个人记录，不记录敏感日志。

导出文件只是界面偏好备份，**不是生活记录备份**。恢复只接受已知卡片 ID 和主题枚举，不把文件中的任意文本插入页面。业务数据导出入口尚未开放。

运行能力与推荐方案见 [存储与同步方案](docs/STORAGE-AND-SYNC.md)，视觉与交互规范见 [设计规范](docs/DESIGN.md)，本阶段验证见 [验证记录](docs/VALIDATION.md)。

## Sites 与 GitHub

Sites 项目已注册；本阶段只保存版本，**不部署、不公开发布**。没有生产访问 URL。`.openai/hosting.json` 保留唯一 Site ID，后续阶段复用。

用户指定代码仓库：https://github.com/lixiuxiu777/LifeHub.git 。每阶段完成验证后推送代码，禁止提交个人数据、备份、凭证与运行时数据库。GitHub 代码可见性与 Sites 访问策略是两套独立机制；静态源码中不能放真实消费等个人记录。

后续建议：先完成 ChatGPT 服务端身份校验、D1 用户隔离与第一项真实待办的端到端闭环，再逐模块实现。等待用户下一阶段指令。
