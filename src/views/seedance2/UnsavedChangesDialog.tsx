import { useEffect, useRef } from 'react'

interface Props {
  saving: boolean
  error?: string | null
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({ saving, error, onSave, onDiscard, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [onCancel, saving])

  return <div className="s2-dialog-backdrop">
    <section className="s2-dialog" role="dialog" aria-modal="true" aria-labelledby="s2-unsaved-title">
      <h2 id="s2-unsaved-title">保存未保存的更改？</h2>
      <p>{saving ? '保存中…' : '当前草稿尚未保存。'}</p>
      {error && <p role="alert" className="s2-dialog-error">{error}</p>}
      <div className="s2-dialog-actions">
        <button type="button" className="s2-btn s2-btn-primary" disabled={saving} onClick={onSave}>保存并继续</button>
        <button type="button" className="s2-btn" disabled={saving} onClick={onDiscard}>放弃更改</button>
        <button ref={cancelRef} type="button" className="s2-btn s2-btn-ghost" disabled={saving} onClick={onCancel}>取消</button>
      </div>
    </section>
  </div>
}
