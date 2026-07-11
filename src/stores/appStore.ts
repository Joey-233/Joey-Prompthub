import { create } from 'zustand'

export type AppView = 'library' | 'test-bench' | 'seedance2' | 'settings'

export interface LayoutPreferences {
  resourceCollapsed: boolean
  detailCollapsed: boolean
  resourceWidth: number
  detailWidth: number
}

const LAYOUT_STORAGE_KEY = 'prompthub:layout'
const DEFAULT_LAYOUT: LayoutPreferences = {
  resourceCollapsed: false,
  detailCollapsed: false,
  resourceWidth: 220,
  detailWidth: 320
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function readLayout(): LayoutPreferences {
  try {
    const saved = window.localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!saved) return { ...DEFAULT_LAYOUT }

    const parsed: unknown = JSON.parse(saved)
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_LAYOUT }

    const layout = parsed as Partial<LayoutPreferences>
    return {
      resourceCollapsed:
        typeof layout.resourceCollapsed === 'boolean'
          ? layout.resourceCollapsed
          : DEFAULT_LAYOUT.resourceCollapsed,
      detailCollapsed:
        typeof layout.detailCollapsed === 'boolean'
          ? layout.detailCollapsed
          : DEFAULT_LAYOUT.detailCollapsed,
      resourceWidth:
        typeof layout.resourceWidth === 'number' && Number.isFinite(layout.resourceWidth)
          ? clamp(layout.resourceWidth, 180, 320)
          : DEFAULT_LAYOUT.resourceWidth,
      detailWidth:
        typeof layout.detailWidth === 'number' && Number.isFinite(layout.detailWidth)
          ? clamp(layout.detailWidth, 280, 480)
          : DEFAULT_LAYOUT.detailWidth
    }
  } catch {
    return { ...DEFAULT_LAYOUT }
  }
}

function persistLayout(layout: LayoutPreferences): void {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // Layout persistence must not prevent in-memory updates.
  }
}

interface AppState {
  currentView: AppView
  pendingTestBenchPromptId: string | null
  layout: LayoutPreferences
  setCurrentView: (view: AppView) => void
  openTestBench: (promptId?: string | null) => void
  clearPendingTestBenchPromptId: () => void
  setPaneCollapsed: (pane: 'resource' | 'detail', collapsed: boolean) => void
  setPaneWidth: (pane: 'resource' | 'detail', width: number) => void
  resetLayout: () => void
  navigationGuard: ((view: AppView) => boolean) | null
  setNavigationGuard: (guard: ((view: AppView) => boolean) | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'library',
  pendingTestBenchPromptId: null,
  layout: readLayout(),
  navigationGuard: null,
  setNavigationGuard: (guard) => set({ navigationGuard: guard }),
  setCurrentView: (view) => set((state) => state.navigationGuard?.(view) ? state : { currentView: view, pendingTestBenchPromptId: null }),
  openTestBench: (promptId) =>
    set((state) => state.navigationGuard?.('test-bench') ? state : ({
      currentView: 'test-bench',
      pendingTestBenchPromptId: promptId ?? null
    })),
  clearPendingTestBenchPromptId: () => set({ pendingTestBenchPromptId: null }),
  setPaneCollapsed: (pane, collapsed) =>
    set((state) => {
      const key = pane === 'resource' ? 'resourceCollapsed' : 'detailCollapsed'
      const layout = { ...state.layout, [key]: collapsed }
      persistLayout(layout)
      return { layout }
    }),
  setPaneWidth: (pane, width) =>
    set((state) => {
      if (!Number.isFinite(width)) return state

      const key = pane === 'resource' ? 'resourceWidth' : 'detailWidth'
      const layout = {
        ...state.layout,
        [key]: clamp(width, pane === 'resource' ? 180 : 280, pane === 'resource' ? 320 : 480)
      }
      persistLayout(layout)
      return { layout }
    }),
  resetLayout: () =>
    set(() => {
      const layout = { ...DEFAULT_LAYOUT }
      persistLayout(layout)
      return { layout }
    })
}))
