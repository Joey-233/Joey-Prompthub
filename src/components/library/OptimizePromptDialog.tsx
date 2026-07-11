import { useState } from 'react'

import { optimizePrompt, type OptimizeDirection } from '../../services/ai'

const directions: OptimizeDirection[] = ['增强细节', '精简表达', '自定义指令']

export function OptimizePromptDialog({
  content,
  onClose,
  onAccept
}: {
  content: string
  onClose: () => void
  onAccept: (value: string) => void
}) {
  const [direction, setDirection] = useState<OptimizeDirection>('增强细节')
  const [customInstruction, setCustomInstruction] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleOptimize() {
    setLoading(true)
    setError('')

    try {
      const optimized = await optimizePrompt({
        content,
        direction,
        customInstruction
      })
      setResult(optimized)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '优化失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-panel" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3 className="dialog-title">AI 优化</h3>
          <button className="dialog-close" type="button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="direction-row">
          {directions.map((item) => (
            <button
              key={item}
              className="filter-chip"
              data-active={direction === item}
              type="button"
              onClick={() => setDirection(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {direction === '自定义指令' ? (
          <textarea
            aria-label="自定义优化指令"
            className="field-textarea"
            placeholder="告诉 AI 你想往哪个方向优化..."
            value={customInstruction}
            onChange={(event) => setCustomInstruction(event.target.value)}
          />
        ) : null}

        <div className="compare-grid">
          <label className="field">
            <span className="field-label">原始提示词</span>
            <textarea className="field-textarea field-textarea-mono" readOnly value={content} />
          </label>
          <label className="field">
            <span className="field-label">优化结果</span>
            <textarea
              className="field-textarea field-textarea-mono"
              readOnly
              value={result}
              placeholder="点击“开始优化”后查看结果"
            />
          </label>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="dialog-actions">
          <button className="editor-action" type="button" onClick={() => void handleOptimize()}>
            {loading ? '优化中...' : '开始优化'}
          </button>
          <button
            className="editor-action"
            disabled={!result}
            type="button"
            onClick={() => onAccept(result)}
          >
            采纳结果
          </button>
        </div>
      </div>
    </div>
  )
}
