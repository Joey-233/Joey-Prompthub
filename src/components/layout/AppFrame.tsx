import type { ReactNode } from 'react'

import { useAppStore, type AppView } from '../../stores/appStore'

const tabs: Array<{ label: string; view: AppView }> = [
  { label: '提示词库', view: 'library' },
  { label: '测试台', view: 'test-bench' },
  { label: 'Seedance2 模板', view: 'seedance2' },
  { label: '设置', view: 'settings' }
]

export function AppFrame({ children }: { children: ReactNode }) {
  const currentView = useAppStore((state) => state.currentView)
  const setCurrentView = useAppStore((state) => state.setCurrentView)

  return (
    <main className="app-shell">
      <div className="frame-panel">
        <header className="topbar">
          <h1 className="brand">Prompt Hub</h1>
          <nav aria-label="主导航" className="topnav">
            {tabs.map((tab) => (
              <button
                key={tab.view}
                className="nav-button"
                data-active={currentView === tab.view}
                type="button"
                onClick={() => setCurrentView(tab.view)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>
        {children}
        <a
          aria-label="访问 joeystudio.art"
          className="app-watermark"
          href="https://joeystudio.art"
          rel="noopener noreferrer"
          target="_blank"
        >
          joeystudio.art 出品
        </a>
      </div>
    </main>
  )
}
