import { useRef, useState, type ChangeEvent } from 'react'

import { describeImage } from '../../services/ai'
import { readImageFileAsDataUrl } from '../../lib/imageFile'

interface RecognizeMode {
  id: string
  label: string
  instruction: string
}

const MODES: RecognizeMode[] = [
  {
    id: 'zh-prompt',
    label: '反推提示词（中文）',
    instruction:
      '仔细观察这张图片，反推出一段可用于 AI 绘图、能复现画面主体、构图、风格、光线和质感的中文提示词。只返回提示词本身，不要任何解释。'
  },
  {
    id: 'en-prompt',
    label: '反推提示词（英文）',
    instruction:
      'Reverse-engineer this image into a single English text-to-image prompt that captures the subject, composition, style, lighting and texture. Return ONLY the prompt text, no explanations.'
  },
  {
    id: 'describe',
    label: '描述画面',
    instruction:
      '用中文详细描述这张图片的画面内容、构图、风格和氛围，便于整理为提示词素材。直接给出描述，不要客套。'
  }
]

export function RecognizeImageDialog({
  onClose,
  onAccept
}: {
  onClose: () => void
  onAccept: (value: string) => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [modeId, setModeId] = useState(MODES[0].id)
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    setError('')
    try {
      // 长边压到 1024，识图足够用，还能避免 base64 体积超过厂商限制
      const dataUrl = await readImageFileAsDataUrl(file, {
        maxDimension: 1024,
        quality: 0.85
      })
      setImageDataUrl(dataUrl)
      setResult('')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '图片读取失败')
    }
  }

  async function handleRecognize() {
    if (!imageDataUrl || loading) {
      return
    }

    const mode = MODES.find((item) => item.id === modeId) ?? MODES[0]
    setLoading(true)
    setError('')

    try {
      const text = await describeImage({
        imageDataUrl,
        instruction: mode.instruction
      })
      setResult(text)
      if (!text) {
        setError('AI 没有返回内容，请换个模型重试')
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '识别失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dialog-backdrop">
      <div className="dialog-panel">
        <div className="dialog-header">
          <h3 className="dialog-title">识图生成提示词</h3>
          <button className="editor-action" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="direction-row">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              className="filter-chip"
              data-active={modeId === mode.id}
              type="button"
              onClick={() => setModeId(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="recognize-grid">
          <div className="recognize-upload">
            {imageDataUrl ? (
              <img alt="待识别图片预览" className="recognize-preview" src={imageDataUrl} />
            ) : (
              <p className="recognize-placeholder">还没有选择图片</p>
            )}
            <button
              className="editor-action"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              {imageDataUrl ? '换一张图片' : '选择图片'}
            </button>
            <input
              ref={fileInputRef}
              hidden
              accept="image/*"
              aria-label="选择要识别的图片"
              type="file"
              onChange={(event) => void handleFileChange(event)}
            />
          </div>
          <label className="field">
            <span className="field-label">识别结果</span>
            <textarea
              className="field-textarea field-textarea-mono"
              placeholder="选择图片后点击「开始识别」"
              readOnly
              value={result}
            />
          </label>
        </div>

        <p className="field-hint">
          识图走设置页「识图（视觉模型）」的配置——默认跟随 AI 服务，可在那里单独指定视觉模型（如
          gpt-4o、glm-4v、qwen-vl-plus）或独立接另一家服务。
        </p>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="dialog-actions">
          <button
            className="editor-action"
            disabled={!imageDataUrl || loading}
            type="button"
            onClick={() => void handleRecognize()}
          >
            {loading ? '识别中...' : '开始识别'}
          </button>
          <button
            className="editor-action"
            disabled={!result}
            type="button"
            onClick={() => onAccept(result)}
          >
            填入快速录入
          </button>
        </div>
      </div>
    </div>
  )
}
