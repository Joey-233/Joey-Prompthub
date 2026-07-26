import type { ReactNode } from 'react'
import { CommandBar } from './CommandBar'
import { NavRail } from './NavRail'

export function AppFrame({ children, title }: { children: ReactNode; title: string }) {
  const isBrowserDemo = document.documentElement.dataset.promptHubMode === 'demo'
  return (
    <main className="app-shell">
      <NavRail />
      <div className="app-workspace">
        {isBrowserDemo && (
          <div className="demo-banner" role="status">
            浏览器演示模式：数据仅保存在当前浏览器，API Key 与真实 AI 调用已禁用。
          </div>
        )}
        <CommandBar title={title} />
        <div className="app-content">{children}</div>
      </div>
    </main>
  )
}
