# 用 Claude Code 开发 Prompt Hub 指南

## 一、环境准备（Windows）

### 1. 安装必备工具

```powershell
# Node.js 20+（推荐用 nvm-windows）
# 下载地址：https://github.com/coreybutler/nvm-windows/releases
nvm install 20
nvm use 20

# 安装 Claude Code
npm install -g @anthropic-ai/claude-code

# better-sqlite3 需要的编译工具
# 安装 Visual Studio Build Tools（选 "C++ 桌面开发" 工作负载）
# 或者用 windows-build-tools：
npm install -g windows-build-tools
```

### 2. 初始化项目目录

```powershell
mkdir prompthub
cd prompthub
```

### 3. 放入配置文件

把这两个文件放到 prompthub 目录下：
- `CLAUDE.md`（Claude Code 自动读取的项目说明）
- `Prompt Hub-开发文档v3.md`（完整产品规格，供参考）

---

## 二、启动 Claude Code

```powershell
cd prompthub
claude
```

Claude Code 启动后会自动读取目录下的 `CLAUDE.md`，了解项目背景。

---

## 三、分步开发（建议的提示词顺序）

不要一次让它把整个项目写完，按模块分步来，每步验证通过再继续。

### 第 1 步：项目脚手架

```
用 electron-vite 初始化项目，技术栈是 React + TypeScript + Tailwind。
配置好 better-sqlite3 和 zustand 依赖。
确保 npm run dev 能正常启动一个空白 Electron 窗口。
```

验证：`npm run dev` 能弹出窗口 → 通过 → 下一步。

### 第 2 步：数据层

```
按 CLAUDE.md 中的数据模型，在 electron/db.ts 中实现 SQLite 数据层。
包含 prompts 和 generations 两张表的 CRUD 操作。
在 electron/preload.ts 中通过 contextBridge 暴露 IPC bridge。
写几个简单的测试：创建、查询、更新、删除提示词。
```

验证：主进程能正确读写数据库 → 通过。

### 第 3 步：悬浮球

```
实现悬浮球窗口（electron/floatingBall.ts + floating-ball.html）。
要求：48x48 圆形红色按钮，无边框透明窗口，始终置顶，可拖拽。
单击展开菜单（快速录入、打开主面板、设置），双击打开主面板。
菜单通过动态调整窗口大小实现，不要创建新窗口。
注意 Windows 上 transparent 窗口需要 app.disableHardwareAcceleration()。
```

验证：悬浮球能拖拽、单击弹菜单、双击打开主窗口 → 通过。

### 第 4 步：提示词库界面

```
实现主面板的提示词库视图（src/views/Library.tsx）。
顶部快速录入栏：输入框 + 类型切换（绘图/LLM）+ 回车存入。
筛选栏：全部/绘图/LLM 标签切换 + 搜索框。
卡片网格：每张卡片显示标题、类型标签、内容预览（2行截断）、标签。
全界面中文。用 Tailwind 写样式。
```

验证：能录入、展示、搜索、筛选提示词 → 通过。

### 第 5 步：编辑面板

```
点击提示词卡片，右侧滑出编辑面板（src/components/PromptEditor.tsx）。
可编辑：标题、内容、反向提示词（绘图类型才显示）、标签。
底部操作按钮：复制到剪贴板、删除。
修改自动保存，防抖 1 秒。
```

### 第 6 步：悬浮球快速录入

```
实现悬浮球的快速录入功能。
点击菜单中的"快速录入"，窗口扩展为迷你输入面板（260x180）。
包含：多行输入框、绘图/LLM 类型切换、存入按钮。
存入后自动缩回 48x48 悬浮球。
同时实现"粘贴板导入"：读取剪贴板文本直接存为绘图类型。
```

### 第 7 步：测试台

```
实现测试台视图（src/views/TestBench.tsx）。
左侧：绘图类型提示词列表，点选加载到右侧。
右侧：提示词编辑区（临时编辑不影响原文）、参数栏（服务选择、
尺寸、步数等下拉/输入）、生成按钮、结果网格（3列占位框）。
出图功能先不实现，预留 adapter 接口（src/services/imageGen.ts），
点击生成时提示"请先在设置中配置出图服务"。
```

### 第 8 步：AI 优化

```
实现 AI 优化功能（src/services/ai.ts）。
在编辑面板添加"AI 优化"按钮，点击弹出优化面板。
支持选择优化方向：增强细节 / 精简 / 自定义指令。
调用 Anthropic 或 OpenAI API，返回优化后的提示词。
用户可以对比原文和新版本，决定是否采纳。
API Key 在设置页配置，存到 Electron safeStorage。
```

### 第 9 步：设置页 + 收尾

```
实现设置页：AI 服务配置（API Key + 模型选择）、出图服务（预留）、
数据管理（导入/导出 JSON）、开机自启开关。
把所有窗口关闭逻辑理顺：关主面板只隐藏，右键悬浮球退出才真正退出。
添加系统托盘图标作为备用入口。
```

---

## 四、常用 Claude Code 命令

在 Claude Code 交互中可以随时用这些：

```
# 让它看当前文件结构
请看一下目前的项目结构，确认和 CLAUDE.md 中的规划是否一致

# 出了 bug
运行 npm run dev 报错了：[粘贴错误信息]，请修复

# 调整样式
提示词卡片的间距太大了，缩小到 8px，卡片圆角改成 4px

# 查看特定文件
看一下 electron/db.ts 的实现，检查有没有问题

# 跑命令
运行 npm run dev 看看效果
```

---

## 五、注意事项

1. **每步都跑一下 `npm run dev` 验证**，不要堆积太多未测试的代码
2. **better-sqlite3 编译问题**是 Windows 上最常见的坑。如果报 node-gyp 错误，让 Claude Code 帮你排查，通常是 Python 或 VS Build Tools 没装好
3. **透明窗口在 Windows 上的坑**：必须调用 `app.disableHardwareAcceleration()`，否则透明区域会显示黑色
4. **文件太大时拆分提示**：如果某个文件超过 300 行，提示 Claude Code 拆分成更小的模块
5. **Git 版本管理**：每完成一步就 commit 一次，方便回滚
