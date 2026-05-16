# Prompt Hub — 开发文档

> 本地提示词管理器。悬浮球常驻桌面，快速收录，统一管理，接 API 出图测试。

---

## 产品结构

应用有两种形态，悬浮球是入口：

```
悬浮球（常驻桌面）
├── 单击 → 展开快捷菜单
│   ├── 快速录入（弹出迷你输入框）
│   ├── 粘贴板导入（读取剪贴板直接存入）
│   ├── 打开主面板
│   └── 设置
├── 双击 → 直接打开主面板
└── 长按拖拽 → 移动位置

主面板（独立窗口）
├── 提示词库：卡片网格 + 快速录入栏 + 编辑
└── 测试台：选词 → 调参 → 出图
```

---

## 悬浮球

### Electron 实现

悬浮球是一个独立的 BrowserWindow，和主面板是两个窗口。

```typescript
// electron/floatingBall.ts
function createFloatingBall() {
  const ball = new BrowserWindow({
    width: 48,
    height: 48,
    type: 'panel',              // macOS：不抢焦点
    frame: false,               // 无边框
    transparent: true,          // 透明背景
    alwaysOnTop: true,          // 常驻最顶层
    resizable: false,
    skipTaskbar: true,          // 不出现在任务栏
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.ts')
    }
  });

  // 初始位置：屏幕右侧中间
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  ball.setPosition(width - 80, Math.round(height / 2));

  ball.loadFile('floating-ball.html');
  return ball;
}
```

### 拖拽实现

悬浮球窗口内用 `-webkit-app-region: drag` 实现拖拽，点击事件区域用 `no-drag`：

```html
<!-- floating-ball.html 核心结构 -->
<div id="ball" style="-webkit-app-region: drag;">
  <!-- 球体本身可拖拽 -->
</div>
<!-- 菜单弹出时用 no-drag，保证可点击 -->
```

### 快捷菜单

单击悬浮球 → 向上弹出菜单（新建一个小窗口，或在同一窗口内动态扩大尺寸）。
推荐方案：动态调整悬浮球窗口大小。

```typescript
// 展开菜单时
ball.setSize(160, 220);
ball.setPosition(x, y - 172); // 向上展开

// 收起时
ball.setSize(48, 48);
ball.setPosition(x, y + 172);
```

### 快速录入

菜单中点「快速录入」→ 窗口扩大为迷你输入面板（260 x 180），包含：输入框 + 类型切换（绘图/LLM）+ 存入按钮。存完自动缩回悬浮球。

### 粘贴板导入

读取系统剪贴板文本，直接以默认类型存入，存完悬浮球闪烁一下反馈。

```typescript
// 主进程
ipcMain.handle('clipboard-import', () => {
  const text = clipboard.readText();
  if (!text.trim()) return null;
  return db.createPrompt(text.trim(), 'image'); // 默认为绘图类型
});
```

### 与主面板的关系

悬浮球和主面板共享同一个 SQLite 数据库。悬浮球通过 IPC 调用主进程的数据库方法，主面板打开时自动刷新数据。

```
悬浮球窗口 ──IPC──▶ 主进程（db.ts）◀──IPC── 主面板窗口
```

---

## 视图 1：提示词库

### 快速收录栏（始终可见）

页面顶部固定一个输入框，粘贴提示词 → 选类型（绘图/LLM）→ 回车即存。
标题自动取前 20 字符，后续可改。

### 卡片网格

每张卡片：标题 + 类型标签 + 内容预览（2 行截断）+ 标签。
筛选栏：全部 / 绘图 / LLM + 搜索框。
点击卡片 → 展开编辑（侧滑面板）。

### 编辑态

标题、提示词内容（等宽字体）、反向提示词（绘图类型显示）、标签（逗号分隔）。
操作按钮：AI 优化 / 复制 / 删除。
AI 优化 → 调 LLM API → 返回新版本 → 用户决定是否采纳。

---

## 视图 2：测试台

左侧：提示词选择列表（仅绘图类型），点选即加载到右侧。

右侧分三块：编辑区（可临时修改，不影响库中原文）、参数栏（服务、尺寸、步数、采样器）、结果区（图片网格，支持并排对比）。

流程：选词 → 微调 → 点生成 → 看图 → 满意则把修改存回库。

---

## 数据模型（SQLite）

```sql
CREATE TABLE prompts (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  type       TEXT NOT NULL CHECK(type IN ('image','llm')),
  content    TEXT NOT NULL,
  negative   TEXT DEFAULT '',
  tags       TEXT DEFAULT '[]',
  params     TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE generations (
  id         TEXT PRIMARY KEY,
  prompt_id  TEXT REFERENCES prompts(id),
  image_data TEXT NOT NULL,
  params     TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 技术栈

| 层 | 选择 |
|----|------|
| 壳 | Electron |
| 前端 | React + TypeScript + Tailwind |
| 状态 | Zustand |
| 数据 | better-sqlite3 |
| AI 优化 | Anthropic / OpenAI SDK |
| 出图 | 预留 adapter 接口 |

---

## 关键接口

### IPC Bridge

```typescript
interface Prompt HubAPI {
  prompts: {
    list(filter?: { type?: string; search?: string }): Prompt[];
    create(content: string, type: 'image' | 'llm'): Prompt;
    update(id: string, patch: Partial<Prompt>): Prompt;
    delete(id: string): void;
  };
  ai: {
    optimize(content: string, direction: string): Promise<string>;
  };
  generate: {
    run(prompt: string, negative: string, params: GenParams): Promise<string>;
    providers(): string[];
  };
  system: {
    clipboardImport(): Promise<Prompt | null>;
    toggleMainWindow(): void;
  };
}
```

### 出图 Adapter（预留）

```typescript
interface ImageGenAdapter {
  name: string;
  defaultParams: Record<string, any>;
  generate(input: {
    prompt: string;
    negative: string;
    width: number;
    height: number;
    steps: number;
    [key: string]: any;
  }): Promise<{ image: string }>;
}
```

---

## 目录结构

```
prompthub/
├── electron/
│   ├── main.ts               # 主进程入口，管理所有窗口
│   ├── floatingBall.ts        # 悬浮球窗口创建与控制
│   ├── mainWindow.ts          # 主面板窗口创建
│   ├── preload.ts             # IPC bridge
│   └── db.ts                  # SQLite 操作
├── src/
│   ├── App.tsx                # 主面板应用
│   ├── floating/
│   │   └── FloatingBall.tsx   # 悬浮球 UI（球体 + 菜单 + 迷你录入）
│   ├── views/
│   │   ├── Library.tsx        # 提示词库
│   │   └── TestBench.tsx      # 测试台
│   ├── components/
│   │   ├── QuickCapture.tsx   # 快速录入栏
│   │   ├── PromptCard.tsx     # 卡片
│   │   ├── PromptEditor.tsx   # 编辑面板
│   │   └── ImageGrid.tsx      # 生成结果网格
│   ├── services/
│   │   ├── ai.ts              # AI 优化
│   │   └── imageGen.ts        # 出图 adapter
│   └── stores/
│       └── store.ts
├── floating-ball.html          # 悬浮球入口 HTML
├── package.json
└── electron-builder.yml
```

---

## 窗口管理逻辑

```typescript
// electron/main.ts 核心流程
app.whenReady().then(() => {
  const ball = createFloatingBall();   // 启动即显示悬浮球
  let mainWin: BrowserWindow | null = null;

  // 悬浮球请求打开主面板
  ipcMain.on('open-main', () => {
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.show();
      mainWin.focus();
    } else {
      mainWin = createMainWindow();
    }
  });

  // 主面板关闭时只隐藏，不退出应用
  // 悬浮球始终存在，关闭悬浮球 = 退出应用
  mainWin?.on('close', (e) => {
    e.preventDefault();
    mainWin?.hide();
  });
});
```

关闭逻辑：关闭主面板 → 仅隐藏（悬浮球仍在）。右键悬浮球菜单中的「退出」→ 真正退出应用。

---

## 开发计划

**第一周：能用**
- 项目脚手架（electron-vite + React + Tailwind）
- 悬浮球窗口：拖拽、单击菜单、双击打开主面板
- SQLite 数据层 + CRUD
- 主面板：提示词库（快速录入 + 卡片网格 + 编辑）
- 导入/导出 JSON

**第二周：好用**
- 悬浮球：快速录入面板、粘贴板导入
- AI 优化（接 Claude / OpenAI）
- 测试台视图 + adapter 接口
- 接入第一个出图服务（推荐先接 SD WebUI）
- 设置页

---

## 设置

仅四项：
1. AI 服务：API Key + 默认模型
2. 出图服务：类型选择 + 服务地址
3. 数据：导出 / 导入 / 数据库路径
4. 外观：亮色 / 暗色 / 跟随系统

额外一项：悬浮球 → 开机自启（Electron `app.setLoginItemSettings`）
