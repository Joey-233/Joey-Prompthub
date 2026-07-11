export function PromptWorkbench({ content, loading, canSave, saveStatus, onContentChange, onSave }: {
  content: string
  loading: boolean
  canSave: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  onContentChange: (value: string) => void
  onSave: () => void
}) {
  const label = saveStatus === 'saved' ? '已同步到提示词库' : saveStatus === 'saving' ? '正在保存...' : saveStatus === 'error' ? '保存失败，请重试' : null
  return <section className="bench-editor-panel">
    <label className="field">
      <span className="field-label">提示词（可临时编辑）</span>
      <textarea className="field-textarea field-textarea-mono" value={content} onChange={(event) => onContentChange(event.target.value)} />
    </label>
    <div className="bench-save-row">
      <button className="secondary-button" disabled={(!canSave && saveStatus !== 'error') || loading || saveStatus === 'saving'} type="button" onClick={onSave}>
        {saveStatus === 'error' ? '重试保存' : '保存回提示词库'}
      </button>
      {label ? <span className="status-note" data-state={saveStatus}>{label}</span> : null}
    </div>
  </section>
}
