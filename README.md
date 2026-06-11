# Prompt Hub

> 悬浮球常驻桌面，快速收录、统一管理 AI 绘图 / LLM 提示词，自带测试台直接出图。

Prompt Hub 是一款本地优先的提示词管理桌面应用。常驻桌面的悬浮球让你随时捕捉灵感，主面板按标签/收藏/最近使用整理提示词，测试台可以直接接入你自己的 OpenAI 兼容 API 出图试跑，**数据全部存在本地 SQLite，不上传任何云端**。

## 核心特性

- 🎈 **悬浮球入口** — 常驻桌面边缘，单击展菜单，双击打开主面板
- 📥 **快速收录** — 迷你输入框 + 剪贴板一键导入，灵感秒进库
- 📚 **分类管理** — `绘图` / `LLM` 双类型 tag，自定义标签，全文搜索
- ✨ **AI 优化** — 一键调用你自己的 API（OpenAI / Claude / DeepSeek / Kimi / GLM / 通义 / 豆包 / Gemini 任选）让提示词更专业
- 👁️ **识图反推** — 上传任意图片，AI 反推出可复现画面的中文/英文绘图提示词；视觉模型可独立配置（跟随 AI 服务换个模型，或单独接一家带自己的 Key）
- 🖼️ **自定义预览图** — 给任意提示词上传一张预览图，卡片直接看效果，不再靠脑补
- 🎨 **出图测试台** — 直接对接 OpenAI 图像 / Stable Diffusion WebUI 跑图，结果带历史回溯
- 🔒 **隐私优先** — 全部数据落在本地 SQLite，API Key 用 Electron `safeStorage` 加密存储
- 🎛️ **完全自定义 API** — 填你自己的 `baseURL` + `apiKey`，任何 OpenAI 兼容端点都能接

## 截图

> 截图待补，本地启动后视觉一致。

## 接入哪些 AI 服务

文字 AI（用于优化提示词）— 内置 9 个预设，全部走 OpenAI Chat Completions 兼容协议：

| 预设 | 默认 baseURL |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| Anthropic Claude | `https://api.anthropic.com/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |
| 月之暗面 Kimi | `https://api.moonshot.cn/v1` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 豆包（火山方舟） | `https://ark.cn-beijing.volces.com/api/v3` |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` |
| 自定义 | 你自己填 |

图像生成 — 4 种 provider：

- OpenAI 图像（`gpt-image-1` / `dall-e-3`）
- 自定义 OpenAI 兼容图像（Azure / 中转 / 自建）
- Stable Diffusion WebUI（AUTOMATIC1111 / Forge 本机）
- Mock（占位测试，不调真实接口）

所有 HTTP 调用都从 Electron 主进程发起，**绕开浏览器 CORS**，任何 OpenAI 兼容端点都能直接调通。

## 技术栈

- **Electron 41** + electron-vite
- **React 19** + TypeScript + Tailwind CSS 4
- **Zustand** 状态管理
- **better-sqlite3** 本地数据库
- **Vitest** 单元/组件测试（112 个测试，覆盖主进程 HTTP 调用、识图多模态协议与端点解析、9 家厂商预设、DB 边界、Settings 切换流程）

## 开发

要求 Node 20+ / npm 10+。Windows 上首次安装需要 [Visual Studio Build Tools](https://visualstudio.microsoft.com/zh-hans/visual-cpp-build-tools/) 编译 `better-sqlite3`。

```bash
# 安装依赖（postinstall 会自动 rebuild better-sqlite3 给 Electron）
npm install

# 启动开发模式
npm run dev

# 跑测试
npm test

# 类型检查
npm run typecheck

# 生产构建（先 typecheck 再 build）
npm run build

# 预览构建产物
npm run preview
```

## 项目结构

```
electron/
  main.ts                主进程入口
  floatingBall.ts        悬浮球窗口
  mainWindow.ts          主面板窗口
  preload.ts             IPC bridge
  db.ts                  SQLite CRUD
  aiCalls.ts             第三方 API 调用（OpenAI / SD WebUI 兼容）
  secretStore.ts         safeStorage 封装
  ipc/registerIpc.ts     IPC handler 注册
src/
  App.tsx                主面板根组件
  floating/              悬浮球 UI
  views/                 Library / TestBench / Settings 三大视图
  components/            UI 组件
  services/              前端 provider 转发层
  stores/                Zustand store
  shared/                跨进程共享类型
docs/                    产品/设计/快速开始文档
```

## 数据存储

- 主数据库：`%APPDATA%\Prompt Hub\prompthub.db`（Windows）
- 加密密钥：`%APPDATA%\Prompt Hub\secure-store.json`（safeStorage DPAPI 加密）
- 开发模式数据库：项目根目录下的 `prompthub.db`

启动时会自动从旧版本 `promptvault.db` 迁移到 `prompthub.db`。

## 当前状态

- ✅ 112 个自动化测试全部通过
- ✅ 9 家主流 AI 厂商 baseURL 协议层验证
- ✅ TypeScript 严格模式 + 生产构建零警告
- ✅ `npm run dist:win` 出 Windows NSIS 安装包（electron-builder）
- ⚠️ 未代码签名，Windows 首次运行会触发 SmartScreen 警告（点【更多信息】→【仍要运行】）

## 文档

更详细的文档放在 `docs/官网资料/`：

- [产品介绍](docs/官网资料/产品介绍.md)
- [功能特性](docs/官网资料/功能特性.md)
- [快速开始](docs/官网资料/快速开始.md)
- [技术栈](docs/官网资料/技术栈.md)
- [常见问题](docs/官网资料/常见问题.md)
- [更新日志](docs/官网资料/更新日志.md)

## License

[MIT](LICENSE)
