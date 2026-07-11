interface Props {
  name: string
  pending: boolean
  error: string | null
  onNameChange: (name: string) => void
  onCancel: () => void
  onSave: () => void
}

export function PresetSaveDialog({ name, pending, error, onNameChange, onCancel, onSave }: Props) {
  return <div className="s2-dialog-backdrop">
    <section className="s2-dialog" role="dialog" aria-modal="true" aria-labelledby="s2-preset-title">
      <h2 id="s2-preset-title">保存镜头预设</h2>
      <label>预设名称<input autoFocus className="s2-input" value={name} disabled={pending} onChange={(event) => onNameChange(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <div className="s2-dialog-actions">
        <button className="s2-btn" disabled={pending} onClick={onCancel}>取消</button>
        <button className="s2-btn s2-btn-primary" disabled={pending || !name.trim()} onClick={onSave}>{pending ? '保存中…' : '保存预设'}</button>
      </div>
    </section>
  </div>
}
