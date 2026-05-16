import { useEffect, useState } from 'react'

export function SecretField({
  label,
  storageKey,
  actionLabel
}: {
  label: string
  storageKey: string
  actionLabel: string
}) {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState('未配置')

  useEffect(() => {
    void window.promptHub.secure.has(storageKey).then((hasValue) => {
      setStatus(hasValue ? '已配置' : '未配置')
    })
  }, [storageKey])

  async function handleSave() {
    if (!value.trim()) {
      return
    }

    await window.promptHub.secure.set(storageKey, value.trim())
    setValue('')
    setStatus('已配置')
  }

  return (
    <div className="secret-field">
      <label className="field">
        <span className="field-label">{label}</span>
        <input
          aria-label={label}
          className="field-input"
          placeholder="sk-..."
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <div className="secret-actions">
        <span className="secret-status">{status}</span>
        <button className="editor-action" type="button" onClick={() => void handleSave()}>
          {actionLabel}
        </button>
      </div>
    </div>
  )
}
