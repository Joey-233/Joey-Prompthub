interface Props {
  kind: '模板' | '预设' | '类目'
  name: string
  pending: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

export function DestructiveConfirmationDialog({
  kind,
  name,
  pending,
  error,
  onCancel,
  onConfirm
}: Props) {
  return (
    <ModalDialog
      backdropClassName="s2-dialog-backdrop"
      panelClassName="s2-dialog"
      titleId="s2-delete-title"
      closeDisabled={pending}
      onClose={onCancel}
    >
      <h2 id="s2-delete-title">删除{kind}</h2>
      <p>确定删除“{name}”吗？</p>
      {error && <p role="alert">{error}</p>}
      <div className="s2-dialog-actions">
        <button className="s2-btn" disabled={pending} onClick={onCancel}>
          取消
        </button>
        <button className="s2-btn s2-btn-primary" disabled={pending} onClick={onConfirm}>
          {pending ? '删除中…' : '确认删除'}
        </button>
      </div>
    </ModalDialog>
  )
}
import { ModalDialog } from '../../components/ui/ModalDialog'
