import type { ReactNode } from 'react'
import { CommandBar } from './CommandBar'
import { NavRail } from './NavRail'

export function AppFrame({ children, title }: { children: ReactNode; title: string }) {
  return (
    <main className="app-shell">
      <NavRail />
      <div className="app-workspace"><CommandBar title={title} /><div className="app-content">{children}</div></div>
    </main>
  )
}
