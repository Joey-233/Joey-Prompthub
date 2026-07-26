import { useCallback, useEffect, useRef, useState } from 'react'

export function SecretField({
  label,
  storageKey,
  actionLabel,
  knownConfigured,
  onConfiguredChange
}: {
  label: string
  storageKey: string
  actionLabel: string
  knownConfigured?: boolean | null
  onConfiguredChange?: (configured: boolean) => void
}) {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState('读取中…')
  const [configured, setConfigured] = useState(false)
  const [pending, setPending] = useState(knownConfigured === undefined)
  const browserDemo = document.documentElement.dataset.promptHubMode === 'demo'
  const mounted = useRef(false)
  const operation = useRef(0)

  const publish = useCallback(
    (nextConfigured: boolean, nextStatus: string) => {
      setConfigured(nextConfigured)
      setStatus(nextStatus)
      onConfiguredChange?.(nextConfigured)
    },
    [onConfiguredChange]
  )

  useEffect(() => {
    mounted.current = true
    if (knownConfigured !== undefined) {
      return () => {
        mounted.current = false
        operation.current += 1
      }
    }
    const sequence = ++operation.current
    void window.promptHub.secure
      .has(storageKey)
      .then((hasValue) => {
        if (!mounted.current || operation.current !== sequence) return
        publish(hasValue, hasValue ? '已加密保存' : '未配置')
      })
      .catch(() => {
        if (mounted.current && operation.current === sequence) setStatus('读取失败，请重试')
      })
      .finally(() => {
        if (mounted.current && operation.current === sequence) setPending(false)
      })
    return () => {
      mounted.current = false
      operation.current += 1
    }
  }, [storageKey, knownConfigured, publish])

  const displayConfigured = knownConfigured === undefined ? configured : Boolean(knownConfigured)
  const displayPending = pending || knownConfigured === null
  const displayStatus =
    knownConfigured === undefined
      ? status
      : knownConfigured === null
        ? '读取中…'
        : knownConfigured
          ? '已加密保存'
          : '未配置'

  async function run(action: () => Promise<void>, onSuccess: () => void, error: string) {
    if (pending) return
    const sequence = ++operation.current
    setPending(true)
    try {
      await action()
      if (mounted.current && operation.current === sequence) onSuccess()
    } catch {
      if (mounted.current && operation.current === sequence) setStatus(error)
    } finally {
      if (mounted.current && operation.current === sequence) setPending(false)
    }
  }

  function handleSave() {
    const next = value.trim()
    if (!next) return
    void run(
      () => window.promptHub.secure.set(storageKey, next),
      () => {
        setValue('')
        publish(true, '✓ 已加密保存到本地')
      },
      '保存失败，请重试'
    )
  }

  function handleClear() {
    void run(
      () => window.promptHub.secure.delete(storageKey),
      () => {
        setValue('')
        publish(false, '未配置')
      },
      '清除失败，请重试'
    )
  }

  return (
    <div className="secret-field">
      <label className="field">
        <span className="field-label">{label}</span>
        <input
          aria-label={label}
          className="field-input"
          placeholder="请输入你自己的 API Key"
          type="password"
          value={value}
          disabled={displayPending || browserDemo}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <div className="secret-actions">
        <span className="secret-status" data-state={displayConfigured ? 'set' : 'unset'}>
          {browserDemo ? '浏览器演示模式不保存密钥' : displayStatus}
        </span>
        <div className="secret-controls">
          {displayConfigured && (
            <button
              className="editor-action editor-action-danger"
              type="button"
              disabled={displayPending}
              onClick={handleClear}
            >
              清除
            </button>
          )}
          <button
            className="editor-action"
            type="button"
            disabled={displayPending || browserDemo}
            onClick={handleSave}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
