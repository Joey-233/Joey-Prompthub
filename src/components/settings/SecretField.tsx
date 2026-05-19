import { useEffect, useRef, useState } from 'react'

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
  const [justSaved, setJustSaved] = useState(false)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void window.promptHub.secure.has(storageKey).then((hasValue) => {
      setStatus(hasValue ? '已加密保存' : '未配置')
    })
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    }
  }, [storageKey])

  async function handleSave() {
    if (!value.trim()) {
      return
    }

    await window.promptHub.secure.set(storageKey, value.trim())
    setValue('')
    setStatus('已加密保存')
    setJustSaved(true)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setJustSaved(false), 3000)
  }

  async function handleClear() {
    await window.promptHub.secure.delete(storageKey)
    setValue('')
    setStatus('未配置')
    setJustSaved(false)
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
        <span className="secret-status" data-state={status === '已加密保存' ? 'set' : 'unset'}>
          {justSaved ? '✓ 已加密保存到本地' : status}
        </span>
        {status === '已加密保存' ? (
          <button
            className="editor-action editor-action-danger"
            type="button"
            onClick={() => void handleClear()}
          >
            清除
          </button>
        ) : null}
        <button className="editor-action" type="button" onClick={() => void handleSave()}>
          {actionLabel}
        </button>
      </div>
    </div>
  )
}
