import type { ReactNode } from 'react'

export interface CommandBarProps {
  title: string
  status?: ReactNode
  search?: ReactNode
  actions?: ReactNode
}

export function CommandBar({ title, status, search, actions }: CommandBarProps) {
  return (
    <header className="command-bar">
      <h1>{title}</h1>
      {status && <div className="command-status">{status}</div>}
      {search && <div className="command-search">{search}</div>}
      {actions && <div className="command-actions">{actions}</div>}
    </header>
  )
}
