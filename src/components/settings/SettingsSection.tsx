import type { ReactNode } from 'react'

export function SettingsSection({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="settings-section">
      <div className="settings-section-header">
        <h2 className="settings-section-title">{title}</h2>
        {description ? <p className="settings-section-description">{description}</p> : null}
      </div>
      <div className="settings-section-body">{children}</div>
    </section>
  )
}
