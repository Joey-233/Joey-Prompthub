import { ModalDialog } from '../../components/ui/ModalDialog'

interface Props {
  saving: boolean
  error?: string | null
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({ saving, error, onSave, onDiscard, onCancel }: Props) {
  return (
    <ModalDialog
      backdropClassName="s2-dialog-backdrop"
      panelClassName="s2-dialog"
      titleId="s2-unsaved-title"
      closeDisabled={saving}
      onClose={onCancel}
    >
      <h2 id="s2-unsaved-title">保存未保存的更改？</h2>
      <p>{saving ? '保存中…' : '当前草稿尚未保存。'}</p>
      {error && (
        <p role="alert" className="s2-dialog-error">
          {error}
        </p>
      )}
      <div className="s2-dialog-actions">
        <button type="button" className="s2-btn s2-btn-primary" disabled={saving} onClick={onSave}>
          保存并继续
        </button>
        <button type="button" className="s2-btn" disabled={saving} onClick={onDiscard}>
          放弃更改
        </button>
        <button
          data-autofocus="true"
          type="button"
          className="s2-btn s2-btn-ghost"
          disabled={saving}
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </ModalDialog>
  )
}
