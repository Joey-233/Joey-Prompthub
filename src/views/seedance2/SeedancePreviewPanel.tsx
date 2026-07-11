interface Props {
  preview: string
  copyStatus: { kind: 'success' | 'error'; text: string } | null
  onCopy: () => void
}

export function SeedancePreviewPanel({ preview, copyStatus, onCopy }: Props) {
  return <aside className="s2-preview-wrap" aria-label="实时预览">
    <div className="s2-preview-header">
      <strong>实时预览</strong>
      <button className="s2-btn s2-btn-primary" onClick={onCopy}>复制</button>
    </div>
    {copyStatus && <p role={copyStatus.kind === 'error' ? 'alert' : 'status'}>{copyStatus.text}</p>}
    <pre className="s2-preview">{preview}</pre>
  </aside>
}
