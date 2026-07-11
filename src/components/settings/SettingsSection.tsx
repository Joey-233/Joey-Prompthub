import type { ReactNode } from 'react'

export function SettingsSection({
  title,
  description,
  status,
  children
}: {
  title: string
  description?: string
  status?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title">{title}</h2>
        {description ? <p className="settings-section-description">{description}</p> : null}
        {status ? <div className="settings-section-status" aria-live="polite">{status}</div> : null}
      </div>
      <div className="settings-section-body">{children}</div>
    </section>
  )
}
