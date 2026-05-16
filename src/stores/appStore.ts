import { create } from 'zustand'

export type AppView = 'library' | 'test-bench' | 'settings'

interface AppState {
  currentView: AppView
  pendingTestBenchPromptId: string | null
  setCurrentView: (view: AppView) => void
  openTestBench: (promptId?: string | null) => void
  clearPendingTestBenchPromptId: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'library',
  pendingTestBenchPromptId: null,
  setCurrentView: (view) => set({ currentView: view, pendingTestBenchPromptId: null }),
  openTestBench: (promptId) =>
    set({
      currentView: 'test-bench',
      pendingTestBenchPromptId: promptId ?? null
    }),
  clearPendingTestBenchPromptId: () => set({ pendingTestBenchPromptId: null })
}))
