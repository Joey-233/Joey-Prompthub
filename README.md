# Joey Prompthub

Joey Prompthub 是一款 Windows 桌面提示词工作台，用悬浮球快速收录灵感，并在同一处管理、检索和优化 AI 绘图与 LLM 提示词。

## 主要能力

- 悬浮球快速收录，双击进入主界面
- 标题、标签、收藏、全文搜索和最近使用记录
- AI 提示词优化与图片反推，统一使用 OpenAI Chat Completions 兼容文字接口
- 豆包、DeepSeek 官方服务预设和自定义 OpenAI 兼容地址
- Seedance 2 分镜提示词模板编辑器
- 浅色/深色主题、键盘可用的对话框和响应式窗口布局

全新安装会预置 4 条经过确认的提示词，并自动载入七分区的“默认模板1”（风格设定、角色与素材锚定、运镜设定、画面描述、镜头序列、音效设定、特殊要求）。这些初始数据只写入新数据库，不覆盖升级用户已有内容。

## 下载与校验

正式签名安装包仅通过 [GitHub Releases](https://github.com/Joey-233/Joey-Prompthub/releases) 发布。发布流水线要求 Windows Authenticode 签名，并同时提供 `SHA256SUMS.txt`。签名前，官网可以提供明确标注“未签名”的 Windows 预览安装包；Windows 可能提示“未知发布者”。

项目官网会优先读取最新 GitHub Release；尚无正式 Release 时，使用受版本控制的下载清单提供 Windows 预览版，并保持 macOS 为待发布：

- [Joey Prompthub 官网](https://joeystudio.art/prompthub/)

在 PowerShell 中校验：

```powershell
Get-AuthenticodeSignature '.\Joey Prompthub-0.3.0-Setup-x64.exe'
Get-FileHash '.\Joey Prompthub-0.3.0-Setup-x64.exe' -Algorithm SHA256
```

签名状态应为 `Valid`，哈希应与同一 Release 中的 `SHA256SUMS.txt` 一致。

## 隐私说明

提示词、图片、历史兼容数据和设置默认保存在本机。API Key 使用 Electron `safeStorage` 加密，无法安全加密时应用拒绝保存明文密钥。

当你主动使用 AI 优化或识图能力时，相应的提示词、图片和 API Key 会发送到你选择的服务商或自定义端点；这部分数据处理受该服务商政策约束。Joey Prompthub 本身不含遥测或广告。详见 [PRIVACY.md](PRIVACY.md)。

## 开发

Windows 与 macOS 共享源码。要求：

- Node.js 22.12 或更高版本（推荐使用仓库 `.nvmrc`）
- npm
- Windows 原生依赖编译环境；安装时会为 Electron 重建 `better-sqlite3`

```bash
npm ci
npm run dev
```

常用质量命令：

```bash
npm run lint
npm run format:check
npm run test:coverage
npm run build
npm run test:db-electron
npm run test:e2e
npm run check:bundle
npm run verify
```

Windows 安装包：

```bash
npm run dist:win
```

本地构建不会冒充正式签名版本。正式发布步骤见 [docs/RELEASE.md](docs/RELEASE.md)。

Mac mini 首次配置、本地 DMG、Developer ID 签名和 Apple 公证流程见 [MAC-DEVELOPMENT.md](MAC-DEVELOPMENT.md)。由于 `better-sqlite3` 是原生依赖，macOS 必须执行 `npm ci`，不能复用 Windows 的 `node_modules`。

## 数据位置

Windows 正式版继续使用原有 `%APPDATA%\Prompt Hub` 数据目录，以保证从旧版 Prompt Hub 升级到 Joey Prompthub 后，提示词、设置和 API Key 不会丢失。macOS 使用 `~/Library/Application Support/Joey Prompthub`：

- `prompthub.db`：SQLite 主数据库
- `prompthub-assets\`：内容寻址的本地图片
- `secure-store.json`：经系统凭据能力加密的 API Key

开发模式默认把数据库和资源目录放在项目根目录。应用会保留旧版 `promptvault.db`，并在校验后迁移到新库。

## 技术栈

Electron、React、TypeScript、Zustand、better-sqlite3、Vitest、Playwright。

## 安全与许可证

安全问题请阅读 [SECURITY.md](SECURITY.md)。项目采用 [MIT License](LICENSE)。
