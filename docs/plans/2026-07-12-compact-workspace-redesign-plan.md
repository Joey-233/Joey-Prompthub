# Prompt Hub Compact Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Prompt Hub's space-heavy shell with a compact, responsive workspace and migrate Library, TestBench, Seedance2, and Settings without changing existing business storage or provider behavior.

**Architecture:** Add a shared shell composed of a navigation rail, command bar, and responsive three-pane workspace. Keep business state inside the existing feature stores/components; only layout preferences live in `appStore`. Migrate one view at a time so every commit remains testable and preserves the user's current uncommitted Seedance2 and multi-image work.

**Tech Stack:** Electron 41, React 19, TypeScript 6, Zustand 5, Vitest 4, Testing Library, CSS

---

## Preconditions and file map

The working tree already contains user-owned uncommitted changes. Do not reset, checkout, stash, or overwrite them. Before each task, run `git diff --` followed by the exact file list in that task's **Files** section, then stage only those named files.

New shared files:

- `src/components/layout/NavRail.tsx`: global navigation and accessible labels.
- `src/components/layout/CommandBar.tsx`: title, status, search/action slots.
- `src/components/layout/WorkspaceLayout.tsx`: resource/main/detail panes and responsive drawers.
- `src/components/layout/WorkspaceLayout.test.tsx`: collapse, drawer, and keyboard behavior.
- `src/components/layout/UnsavedChangesDialog.tsx`: explicit save/discard/cancel decision.
- `src/components/layout/UnsavedChangesDialog.test.tsx`: dialog semantics and callbacks.
- `src/components/library/LibrarySidebar.tsx`: library filter navigation.
- `src/components/library/LibraryToolbar.tsx`: search and sort controls above the prompt grid.
- `src/components/test-bench/GenerationSettingsPanel.tsx`: provider and generation controls extracted from `PromptWorkbench`.
- `src/components/settings/SettingsNav.tsx`: settings category navigation.
- `src/views/Seedance2.test.tsx`: draft protection and workspace behavior.

Existing files with focused changes:

- `src/stores/appStore.ts`: UI panel preferences and persistence.
- `src/App.tsx`, `src/components/layout/AppFrame.tsx`, `src/App.test.tsx`: shared shell integration.
- `src/views/Library.tsx`, library components/tests: compact always-visible capture and inspector layout.
- `src/views/TestBench.tsx`, test-bench components/tests: list/results/settings separation.
- `src/views/Seedance2.tsx`, `src/views/seedance2/SortableSegment.tsx`: section navigation, preview pane, unsaved guard.
- `src/views/Settings.tsx`, settings components/tests: category navigation and status/help pane.
- `src/index.css`, `src/styles/theme.css`: compact tokens, pane layout, responsive rules, focus and reduced-motion styles.

## Task 1: Persist layout preferences in `appStore`

**Files:**
- Modify: `src/stores/appStore.ts`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing store tests through the rendered app**

Add these assertions to `src/App.test.tsx`:

```tsx
it('restores collapsed workspace panes from local storage', () => {
  localStorage.setItem(
    'prompthub:layout',
    JSON.stringify({ resourceCollapsed: true, detailCollapsed: false, resourceWidth: 220, detailWidth: 320 })
  )

  render(<App />)

  expect(screen.getByRole('main')).toHaveAttribute('data-resource-collapsed', 'true')
})
```

Reset `localStorage` and the Zustand store in the test `beforeEach` so tests do not leak layout state.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the shell has no `data-resource-collapsed` state and layout preferences are not restored.

- [ ] **Step 3: Implement serializable layout preferences**

Add to `src/stores/appStore.ts`:

```ts
export interface LayoutPreferences {
  resourceCollapsed: boolean
  detailCollapsed: boolean
  resourceWidth: number
  detailWidth: number
}

const LAYOUT_KEY = 'prompthub:layout'
const DEFAULT_LAYOUT: LayoutPreferences = {
  resourceCollapsed: false,
  detailCollapsed: false,
  resourceWidth: 220,
  detailWidth: 320
}

function readLayout(): LayoutPreferences {
  try {
    return { ...DEFAULT_LAYOUT, ...JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}') }
  } catch {
    return DEFAULT_LAYOUT
  }
}

function saveLayout(layout: LayoutPreferences) {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
}
```

Extend `AppState` with `layout`, `setPaneCollapsed(pane, collapsed)`, and `setPaneWidth(pane, width)`. Clamp resource width to 180–320px and detail width to 280–480px; call `saveLayout` after each update.

- [ ] **Step 4: Run the test and typecheck**

Run: `npm test -- src/App.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/stores/appStore.ts src/App.test.tsx
git commit -m "feat(layout): persist workspace preferences"
```

## Task 2: Build and integrate the shared application shell

**Files:**
- Create: `src/components/layout/NavRail.tsx`
- Create: `src/components/layout/CommandBar.tsx`
- Create: `src/components/layout/WorkspaceLayout.tsx`
- Create: `src/components/layout/WorkspaceLayout.test.tsx`
- Modify: `src/components/layout/AppFrame.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/index.css`
- Modify: `src/styles/theme.css`

- [ ] **Step 1: Write failing navigation and workspace tests**

Test that four navigation buttons exist, the active button exposes `aria-current="page"`, resource/detail collapse buttons change state, and pressing `ArrowLeft`/`ArrowRight` on a separator adjusts its `aria-valuenow`.

```tsx
expect(screen.getByRole('button', { name: '提示词库' })).toHaveAttribute('aria-current', 'page')
expect(screen.getByRole('separator', { name: '调整资源栏宽度' })).toHaveAttribute('aria-valuenow', '220')
await user.keyboard('{ArrowRight}')
expect(screen.getByRole('separator', { name: '调整资源栏宽度' })).toHaveAttribute('aria-valuenow', '228')
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- src/App.test.tsx src/components/layout/WorkspaceLayout.test.tsx`

Expected: FAIL because the new components and ARIA contracts do not exist.

- [ ] **Step 3: Implement `NavRail` and `CommandBar`**

Use the existing `AppView` values. Render text labels visually at wide rail hover/focus only, but keep accessible names always present. `CommandBar` accepts this interface:

```ts
interface CommandBarProps {
  title: string
  status?: ReactNode
  search?: ReactNode
  actions?: ReactNode
}
```

- [ ] **Step 4: Implement `WorkspaceLayout`**

Use this public contract:

```ts
interface WorkspaceLayoutProps {
  resource?: ReactNode
  resourceLabel?: string
  main: ReactNode
  detail?: ReactNode
  detailLabel?: string
}
```

At `max-width: 1319px`, render detail content in a fixed drawer controlled by a command-bar button. At `max-width: 1023px`, use drawers for both auxiliary panes. Separators use `role="separator"`, `tabIndex={0}`, `aria-orientation="vertical"`, and 8px keyboard increments. Double click restores 220px/320px defaults.

- [ ] **Step 5: Replace the old top navigation shell**

`AppFrame` renders `NavRail` beside a `.app-workspace`. Remove the centered `.frame-panel`, watermark overlay, large top navigation buttons, and 24px shell padding. `App.tsx` continues selecting the existing view; each view will provide its own command bar during later tasks.

- [ ] **Step 6: Add base compact visual tokens**

Set tokens in `theme.css`:

```css
:root {
  --pv-space-1: 8px;
  --pv-space-2: 12px;
  --pv-space-3: 16px;
  --pv-radius-control: 8px;
  --pv-radius-panel: 12px;
  --pv-nav-width: 58px;
  --pv-command-height: 48px;
}
```

Add visible `:focus-visible` styles and a `prefers-reduced-motion: reduce` rule that disables nonessential transitions.

- [ ] **Step 7: Run focused and full shell verification**

Run: `npm test -- src/App.test.tsx src/components/layout/WorkspaceLayout.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/components/layout src/App.tsx src/App.test.tsx src/index.css src/styles/theme.css
git commit -m "feat(layout): add compact application workspace"
```

## Task 3: Migrate Library and preserve zero-step quick capture

**Files:**
- Create: `src/components/library/LibrarySidebar.tsx`
- Create: `src/components/library/LibraryToolbar.tsx`
- Modify: `src/views/Library.tsx`
- Modify: `src/views/Library.test.tsx`
- Modify: `src/components/library/QuickCapture.tsx`
- Modify: `src/components/library/QuickCapture.test.tsx`
- Modify: `src/components/library/LibraryFilters.tsx`
- Modify: `src/components/library/PromptEditor.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write failing quick-capture and layout tests**

Add tests that the capture textbox is present immediately, starts compact, expands on focus or multiline input, saves with `Ctrl+Enter`, and returns to compact state after an empty blur.

```tsx
const capture = screen.getByRole('textbox', { name: '快速录入' })
expect(capture.closest('[data-expanded]')).toHaveAttribute('data-expanded', 'false')
await user.click(capture)
expect(capture.closest('[data-expanded]')).toHaveAttribute('data-expanded', 'true')
await user.type(capture, 'cinematic portrait{Control>}{Enter}{/Control}')
expect(window.promptHub.prompts.create).toHaveBeenCalled()
```

Add a Library test asserting the filters are in an `aside` named “提示词筛选” and the editor is an `aside` named “提示词详情”.

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/components/library/QuickCapture.test.tsx src/views/Library.test.tsx`

Expected: FAIL on expansion state and named workspace regions.

- [ ] **Step 3: Implement compact inline capture**

Keep it always rendered at the top of the center pane. Derive `expanded` from focus, non-empty content, tags, or an open recognition dialog. Use an auto-growing textarea capped at 140px. Preserve existing type tags, tag entry, recognition, save behavior, and keyboard shortcut.

- [ ] **Step 4: Move filters and editor into workspace panes**

`LibrarySidebar` owns filter and tag controls. `Library.tsx` renders:

```tsx
<>
  <CommandBar title="提示词库" />
  <WorkspaceLayout
    resource={<LibrarySidebar />}
    resourceLabel="提示词筛选"
    main={
      <div className="library-main">
        <QuickCapture />
        <LibraryToolbar />
        <div className="prompt-grid">{promptCards}</div>
      </div>
    }
    detail={
      selectedPrompt
        ? <PromptEditor prompt={selectedPrompt} />
        : <div className="empty-state">选择提示词以查看详情</div>
    }
    detailLabel="提示词详情"
  />
</>
```

`promptCards` is the existing `visiblePrompts.map(...)` result extracted into a local variable, not a new state source. Keep selection repair when filters hide the selected record. `PromptEditor` retains debounce autosave but displays `saving`, `saved`, or `error` beside the detail heading; an error button reruns the same patch.

- [ ] **Step 5: Add Library-specific compact CSS**

Use 12px pane padding, 8px card gaps, 10px card radius, and no nested outer card around the entire list. Ensure preview images retain their current multi-image hover behavior.

- [ ] **Step 6: Verify Library behavior**

Run: `npm test -- src/components/library src/views/Library.test.tsx src/App.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/views/Library.tsx src/views/Library.test.tsx src/components/library src/index.css
git commit -m "feat(library): add compact capture workspace"
```

## Task 4: Separate TestBench resources, results, and generation settings

**Files:**
- Create: `src/components/test-bench/GenerationSettingsPanel.tsx`
- Modify: `src/views/TestBench.tsx`
- Modify: `src/views/TestBench.test.tsx`
- Modify: `src/components/test-bench/PromptWorkbench.tsx`
- Modify: `src/components/test-bench/PromptList.tsx`
- Modify: `src/components/test-bench/HistoryPanel.tsx`
- Modify: `src/components/test-bench/GenerationGrid.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write failing region and error-placement tests**

Assert named regions “绘图提示词”, “生成结果”, and “生成参数”. Cause generation-history persistence to reject and assert the error is inside the result region while the generate button is re-enabled.

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/views/TestBench.test.tsx`

Expected: FAIL because parameters and prompt editing are still combined and errors are not scoped to the result area.

- [ ] **Step 3: Extract generation parameters**

Move provider, size, steps, sampler, quality, count, save status, and Generate action from `PromptWorkbench` to `GenerationSettingsPanel`. Keep `PromptWorkbench` focused on temporary prompt editing and “保存回提示词库”.

- [ ] **Step 4: Compose the workspace**

Use `PromptList` as resource pane, a center pane containing `PromptWorkbench` plus tabbed `GenerationGrid`/`HistoryPanel`, and `GenerationSettingsPanel` as detail pane. Default to results after Generate and keep the selected history scope when switching tabs.

- [ ] **Step 5: Keep errors with the owning operation**

Render `generateError` above the result grid with `role="alert"`; do not clear existing results. Render `saveStatus` next to the prompt-save action. Both failures expose explicit retry buttons that call the existing `generate` or `saveDraft` action.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- src/views/TestBench.test.tsx src/components/test-bench && npm run typecheck`

Expected: PASS.

```powershell
git add src/views/TestBench.tsx src/views/TestBench.test.tsx src/components/test-bench src/index.css
git commit -m "feat(test-bench): separate results and generation controls"
```

## Task 5: Restructure Seedance2 and protect unsaved drafts

**Files:**
- Create: `src/components/layout/UnsavedChangesDialog.tsx`
- Create: `src/components/layout/UnsavedChangesDialog.test.tsx`
- Create: `src/views/Seedance2.test.tsx`
- Modify: `src/views/Seedance2.tsx`
- Modify: `src/views/seedance2/SortableSegment.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write failing unsaved-change tests**

Mock two templates. Edit the title, click another template, and assert a dialog offers “保存并继续”, “放弃更改”, and “取消”. Verify cancel retains the first template, discard loads the second, and save calls `updateTemplate` before loading the second.

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/views/Seedance2.test.tsx src/components/layout/UnsavedChangesDialog.test.tsx`

Expected: FAIL because switching currently overwrites the draft immediately.

- [ ] **Step 3: Implement the reusable decision dialog**

Use `role="dialog"`, `aria-modal="true"`, an initial focus on Cancel, Escape mapped to Cancel, and callbacks `onSave`, `onDiscard`, and `onCancel`. While save is pending, disable all three actions and show “保存中…”.

- [ ] **Step 4: Add pending navigation state to Seedance2**

Store `{ kind: 'template'; record } | { kind: 'new' } | { kind: 'view'; view } | null`. Every template switch and New action calls a single `requestNavigation` function. If `dirty` is false, navigate immediately; otherwise open the dialog. Do not use native `confirm` for unsaved drafts.

- [ ] **Step 5: Move Seedance2 into the shared workspace**

Left pane contains tabs for templates and presets. Center pane contains sticky section navigation plus collapsible Intro, References, Shots, and Style sections. Right pane contains preview and a fixed Copy action. Keep current drag/drop, preset creation, template CRUD, and serialization unchanged.

- [ ] **Step 6: Add accordion accessibility**

Each section header is a button with `aria-expanded` and `aria-controls`. Opening a section updates sticky section navigation. Do not auto-collapse a section while focus remains inside it.

- [ ] **Step 7: Verify and commit**

Run: `npm test -- src/views/Seedance2.test.tsx src/components/layout/UnsavedChangesDialog.test.tsx electron/db.test.ts && npm run typecheck`

Expected: PASS.

```powershell
git add src/views/Seedance2.tsx src/views/Seedance2.test.tsx src/views/seedance2 src/components/layout/UnsavedChangesDialog* src/index.css
git commit -m "feat(seedance2): add focused sections and draft protection"
```

## Task 6: Organize Settings by purpose and expose reliable status

**Files:**
- Create: `src/components/settings/SettingsNav.tsx`
- Modify: `src/views/Settings.tsx`
- Modify: `src/views/Settings.test.tsx`
- Modify: `src/components/settings/SettingsSection.tsx`
- Modify: `src/components/settings/SecretField.tsx`
- Modify: `src/components/settings/ImportExportPanel.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write failing category and status tests**

Assert category buttons “AI 服务”, “视觉模型”, “图像生成”, and “数据与应用”. Select “视觉模型” and verify AI text-provider fields are not shown. Mock `settings.set` rejection and assert “保存失败，点击重试” remains visible beside the owning section.

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/views/Settings.test.tsx`

Expected: FAIL because all sections are currently rendered in one long page and save errors have no persistent section status.

- [ ] **Step 3: Implement category navigation and section status**

Add `activeCategory` local state. `SettingsNav` renders category buttons with `aria-current`. Track per-key status as `idle | saving | saved | error`; `updateSetting` sets saving before the existing `settings.set`, then saved or error. Retrying repeats the same key/value write.

- [ ] **Step 4: Compose the settings workspace**

Use categories as resource pane, the selected form as main pane, and contextual status/help as detail pane. Put advanced base URL/model fields inside `<details>` only when the selected preset allows customization. Keep secret reveal/save semantics and import/export behavior unchanged.

- [ ] **Step 5: Resolve “test connection” without changing IPC contracts**

This redesign does not add a network probe because the approved non-goals prohibit new provider/IPC behavior and a probe could incur third-party requests. Label the action “检查配置”; validate required URL/model/key presence locally and show “配置完整” or exact missing fields. A real network test requires a separate protocol design.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- src/views/Settings.test.tsx src/components/settings && npm run typecheck`

Expected: PASS.

```powershell
git add src/views/Settings.tsx src/views/Settings.test.tsx src/components/settings src/index.css
git commit -m "feat(settings): organize configuration workspace"
```

## Task 7: Complete responsive, keyboard, and visual-state coverage

**Files:**
- Modify: `src/index.css`
- Modify: `src/styles/theme.css`
- Modify: `src/components/layout/WorkspaceLayout.test.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add failing accessibility assertions**

Test drawer focus return, Escape close, separator keyboard resizing, navigation focus visibility class, `aria-current`, and reduced-motion class behavior. Use `window.matchMedia` mocks for 1319px and 1023px breakpoints.

- [ ] **Step 2: Verify failure**

Run: `npm test -- src/components/layout/WorkspaceLayout.test.tsx src/App.test.tsx`

Expected: FAIL for focus return or breakpoint drawer behavior not yet covered.

- [ ] **Step 3: Finish CSS and focus management**

Ensure the center pane has `min-width: 0`, auxiliary panes never squeeze it below 480px at desktop widths, drawers trap focus while open, and closing returns focus to the trigger. Remove superseded `.frame-panel`, `.topbar`, old page padding, and redundant large-radius rules rather than layering overrides indefinitely.

- [ ] **Step 4: Run the full automated suite**

Run: `npm test`

Expected: all tests pass with no unhandled promise rejection.

- [ ] **Step 5: Run type and build verification**

Run: `npm run typecheck && npm run build`

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

```powershell
git add src/index.css src/styles/theme.css src/components/layout/WorkspaceLayout.test.tsx src/App.test.tsx
git commit -m "fix(layout): finalize responsive and accessible behavior"
```

## Task 8: Perform visual QA and final regression review

**Files:**
- Modify only files that fail the checks below.

- [ ] **Step 1: Start the development application**

Run: `npm run dev`

Expected: Electron renderer starts without console errors.

- [ ] **Step 2: Inspect all views at 1440×900**

Verify three panes fit without horizontal scrolling; command bar stays 48px; navigation stays 58px; quick capture starts compact; Seedance preview copy action remains visible.

- [ ] **Step 3: Inspect all views at 1280×720**

Verify the detail pane becomes a drawer where required, the main editor remains usable, long Seedance sections scroll only inside the main pane, and no primary action is below an unreachable viewport edge.

- [ ] **Step 4: Inspect all views at 1024×768**

Verify only the main pane remains inline; resource/detail triggers open the correct drawers; Escape closes them and restores focus.

- [ ] **Step 5: Exercise edge states**

Check empty prompt library, long prompt text, many tags, three preview images, no generation history, provider error, many Seedance shots, unsaved template switch, settings save rejection, and import/export controls.

- [ ] **Step 6: Re-run final verification after QA fixes**

Run: `npm test && npm run typecheck && npm run build`

Expected: all commands exit 0.

- [ ] **Step 7: Review the final diff for scope and sensitive files**

Run:

```powershell
git diff --check
git status --short | Select-String -Pattern 'secure|\.env|\.db|\.log|\.claude|superpowers|cursor|windsurf'
```

Expected: `git diff --check` prints nothing. The sensitive-file scan prints nothing except the deliberately tracked design/plan paths, if present; never stage local database, logs, `.claude`, or `.superpowers` content.

- [ ] **Step 8: Commit QA fixes if any**

Stage the implementation paths explicitly; unchanged paths are ignored by Git:

```powershell
git add src/App.tsx src/components/layout src/components/library src/components/test-bench src/components/settings src/views/Library.tsx src/views/Library.test.tsx src/views/TestBench.tsx src/views/TestBench.test.tsx src/views/Seedance2.tsx src/views/Seedance2.test.tsx src/views/seedance2 src/views/Settings.tsx src/views/Settings.test.tsx src/index.css src/styles/theme.css
git commit -m "fix(ui): address compact workspace visual QA"
```

Before committing, confirm `git diff --cached --name-only` contains only files changed for this redesign. If no files changed during QA, skip this commit.
