# Joey Prompthub macOS 开发与发行

本文档对应 Joey Prompthub v0.3.0。Windows 依赖目录不能直接复制到 macOS；`better-sqlite3` 等原生模块必须在 Mac 上通过 `npm ci` 重新安装。

## 1. Mac mini 准备

建议使用 Apple Silicon Mac mini，并安装：

- 当前受支持的 macOS
- Xcode 与 Xcode Command Line Tools
- 仓库 `.nvmrc` 指定的 Node.js 版本（当前为 Node 24）
- npm

首次安装 Command Line Tools：

```bash
xcode-select --install
```

解压转移包后，在项目目录运行：

```bash
bash scripts/mac-bootstrap.sh
npm run dev
```

`mac-bootstrap.sh` 会执行 `npm ci`、生成 `.icns` 图标并运行项目质量门禁。不要把 Windows 生成的 `node_modules`、`out`、`release`、数据库或密钥文件复制进来。

## 2. 本地开发包

Apple Silicon：

```bash
npm run dist:mac:dev
```

Intel：

```bash
npm run dist:mac:dev -- x64
```

输出位于 `release-mac-dev/`。这个命令明确关闭签名发现和公证，仅用于本机开发验证，不能当成公开发行版。

## 3. 正式签名与公证

公开分发前必须具备：

1. Apple Developer Program 账号；
2. 钥匙串中有效的 `Developer ID Application` 证书；
3. App Store Connect API Key；
4. 可联网访问 Apple 公证服务的 Xcode 环境。

推荐把 App Store Connect API Key 放在 Mac 本机的受控目录或 CI Secret 中，不要放进仓库或转移包：

```bash
export APPLE_API_KEY="/secure/path/AuthKey_XXXXXXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="00000000-0000-0000-0000-000000000000"
```

Apple Silicon 正式版：

```bash
npm run dist:mac:arm64
bash scripts/verify-mac-release.sh release
```

Intel 正式版：

```bash
npm run dist:mac:x64
bash scripts/verify-mac-release.sh release
```

正式构建启用 hardened runtime、主进程与继承 entitlements、Developer ID 签名和 Apple 公证。验证脚本会检查签名、Gatekeeper、公证票据并输出 DMG 的 SHA256。

## 4. macOS 数据位置

macOS 首发版使用 Electron 默认目录：

```text
~/Library/Application Support/Joey Prompthub/
```

其中包括：

- `prompthub.db`
- `prompthub-assets/`
- `secure-store.json`

API Key 通过 Electron `safeStorage` 接入 macOS Keychain。不要把真实数据库、Keychain 内容或 `.env` 文件放进 Git。

## 5. Mac 验收清单

构建完成后逐项检查：

- 主窗口启动、关闭后驻留、Dock 再激活
- 悬浮球拖动、吸边、点击、右键菜单和多显示器
- 全屏应用、Spaces 切换和始终置顶行为
- 菜单栏图标、显示/隐藏、退出
- `Command+Shift+Space` 显示/隐藏悬浮球
- 开机启动开关
- 提示词、图片、模板、设置的重启持久化
- Keychain 首次授权、拒绝授权和重新授权
- 豆包、DeepSeek、自定义 OpenAI 兼容文字接口
- Seedance 2 模板、默认模板、引用按钮和镜头序列
- DMG 安装、覆盖升级、移到 Applications 后启动
- 无签名警告、`spctl` 通过、公证票据有效

Windows 上只能验证共享 TypeScript/React 代码、配置文件和转移包完整性；上述 macOS 原生行为必须在 Mac mini 上完成。

## 6. 官方参考

- Electron 代码签名：[electronjs.org/docs/latest/tutorial/code-signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- electron-builder macOS 配置：[electron.build/mac](https://www.electron.build/mac/)
- electron-builder 公证：[electron.build/docs/notarization](https://www.electron.build/docs/notarization/)
- Apple 公证说明：[developer.apple.com/documentation/security/notarizing-macos-software-before-distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
