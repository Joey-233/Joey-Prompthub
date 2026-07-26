# Joey Prompthub — 开发文档

> Windows 本地优先的提示词工作台。悬浮球负责快速入口，主窗口统一管理提示词、Seedance 2 模板和文字 API 设置。

## 当前产品结构

```text
悬浮球
├── 双击：打开主窗口
├── 拖拽：移动并吸附屏幕边缘
└── 右键：打开快捷菜单或退出

主窗口
├── 提示词库：录入、检索、标签、收藏、编辑、复制、AI 优化、识图
├── Seedance 2：模板、预设、参考锚定、镜头序列、实时预览
└── 设置：一套 OpenAI Chat Completions 兼容文字 API
```

测试台、图像生成接口和生成历史 UI 已下线。数据库仍能读取旧版生成记录，并在备份中保留它们，避免升级或导入旧备份时丢失历史数据。

## 提示词库

- 快速录入支持标题、内容和标签；标题为空时自动从内容生成。
- 卡片始终显示标题，支持搜索、标签筛选、收藏和常用排序。
- 详情编辑器内联显示，不使用独立弹窗；操作区采用两行两列布局。
- AI 优化和识图都走设置页的同一套 OpenAI 兼容 API。
- 识图会发送 `image_url` 多模态消息，因此当前模型必须支持图片输入。
- API Key 不进入数据库、备份或渲染进程，由主进程安全存储。

## Seedance 2

- 用户可以创建、修改、删除模板，并将自定义模板设为默认。
- 模板由可排序的普通文本、参考资料和镜头序列节点组成。
- 参考资料是正常可展开节点，可参与排序、重命名和删除。
- 角色与素材锚定快捷按钮：

  - 角色：`将@###作为主角的视觉参考`
  - 场景：`将@###作为场景的视觉参考`
  - 道具：`将@###作为道具的视觉参考`
  - 音色：`完全使用@###音色`

- 镜头序列支持新增镜头和音色约束；音色约束会写入台词框：
  `（完全使用@###音色，禁止修改台词）`
- 实时预览由模板当前状态序列化生成，保存模板后写入 SQLite。

## 文字 API

设置页只暴露一套 OpenAI Chat Completions 兼容配置：

| 预设             | Base URL                                   | 模型快捷项                                                             |
| ---------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| 豆包（火山方舟） | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-seed-evolving`、`doubao-seed-2.1-pro`、`doubao-seed-2.1-turbo` |
| DeepSeek         | `https://api.deepseek.com`                 | `deepseek-v4-flash`、`deepseek-v4-pro`                                 |
| 自定义           | 用户填写                                   | 任意 OpenAI Chat Completions 兼容模型                                  |

应用不内置 API Key。用户填写的 Key 使用 Electron `safeStorage` 加密并保存在本机。

## 数据与升级兼容

- 数据库：`better-sqlite3`
- 正式版数据目录：`%APPDATA%\Prompt Hub`
- 数据库文件：`prompthub.db`
- 加密密钥文件：`secure-store.json`
- 备份格式标识：`prompthub-backup`

产品显示名称已经改为 Joey Prompthub，但保留上述旧目录名、数据库名、备份格式、自定义资源协议和 `appId`，保证旧版原地升级时数据与安装身份连续。

## 安全边界

- 主窗口与悬浮球使用独立 preload。
- `contextIsolation: true`、`sandbox: true`、`nodeIntegration: false`。
- IPC 同时校验发送窗口和精确页面 URL。
- 所有 IPC 参数在主进程做类型、长度、枚举和格式校验。
- 第三方 HTTP 请求只在主进程发送，API Key 不返回渲染进程。
- 自定义远程端点首次使用前需要用户确认；只允许 HTTPS，开发回环地址除外。
- 导入备份限制文件体积、记录数量和字段结构。
- 密钥文件损坏或系统加密不可用时失败关闭，不会用明文覆盖。

## 主要目录

```text
electron/
├── main.ts                 # 生命周期、窗口、托盘、兼容数据目录
├── mainWindow.ts           # 主窗口安全配置
├── floatingBall.ts         # 悬浮球窗口与拖拽逻辑
├── preload.ts              # 主窗口最小 IPC bridge
├── floatingPreload.ts      # 悬浮球最小 IPC bridge
├── ipc/
│   ├── registerIpc.ts      # IPC 注册与来源校验
│   └── validation.ts       # 输入和备份校验
├── db.ts                   # SQLite、迁移、备份
├── aiCalls.ts              # OpenAI 兼容文本/多模态请求
├── endpointPolicy.ts       # 自定义端点审批
├── httpClient.ts           # 网络限制、超时和响应解析
└── secretStore.ts          # safeStorage 加密密钥

src/
├── views/
│   ├── Library.tsx
│   ├── Seedance2.tsx
│   └── Settings.tsx
├── components/
├── services/ai/
├── stores/
├── styles/
└── shared/

e2e/electron.spec.ts        # 真实 Electron 与打包程序流程
docs/官网主页/              # 静态官网
```

## 发行门禁

```powershell
npm ci
npm audit --audit-level=high
npm run verify
npm run test:e2e
npm run dist:win -- --publish never
```

`npm run verify` 依次执行 Lint、格式检查、覆盖率测试、类型检查、生产构建、Electron SQLite 冒烟和包体预算。

正式 GitHub Release 由标签触发，标签必须与 `package.json` 版本一致；CI 必须取得 Windows 代码签名证书，并在上传前验证 Authenticode 为 `Valid`。本地未签名安装包只能用于测试，不能作为正式公开发行物。
