import { listImageProviders } from '../../services/image/providerRegistry'
import type { ImageGenerationParams, ImageProvider } from '../../services/image/types'

const ALL_PROVIDERS = listImageProviders()

function findProvider(id: string): ImageProvider {
  return ALL_PROVIDERS.find((provider) => provider.id === id) ?? ALL_PROVIDERS[0]
}

export function PromptWorkbench({
  content,
  loading,
  canSave,
  saveStatus,
  providerId,
  params,
  generateError,
  onContentChange,
  onProviderChange,
  onParamsChange,
  onSave,
  onGenerate
}: {
  content: string
  loading: boolean
  canSave: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  providerId: string
  params: ImageGenerationParams
  generateError: string | null
  onContentChange: (value: string) => void
  onProviderChange: (id: string) => void
  onParamsChange: (patch: Partial<ImageGenerationParams>) => void
  onSave: () => void
  onGenerate: () => void
}) {
  const provider = findProvider(providerId)
  const capabilities = provider.capabilities
  const sizeId = `${params.width}x${params.height}`
  const saveStatusLabel =
    saveStatus === 'saved'
      ? '已同步到提示词库'
      : saveStatus === 'saving'
        ? '正在保存...'
        : saveStatus === 'error'
          ? '保存失败，请重试'
          : null

  return (
    <section className="bench-main">
      <div className="bench-editor-panel">
        <label className="field">
          <span className="field-label">提示词（可临时编辑）</span>
          <textarea
            className="field-textarea field-textarea-mono"
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
          />
        </label>
      </div>

      <div className="bench-params-panel">
        <div className="bench-params-row">
          <label className="bench-param-field">
            <span className="bench-param-label">服务</span>
            <select
              aria-label="图像 Provider"
              className="bench-param-select"
              value={providerId}
              onChange={(event) => onProviderChange(event.target.value)}
            >
              {ALL_PROVIDERS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {capabilities.sizes ? (
            <label className="bench-param-field">
              <span className="bench-param-label">尺寸</span>
              <select
                aria-label="尺寸"
                className="bench-param-select"
                value={sizeId}
                onChange={(event) => {
                  const next = capabilities.sizes?.find(
                    (option) => option.id === event.target.value
                  )
                  if (next) {
                    onParamsChange({ width: next.width, height: next.height })
                  }
                }}
              >
                {capabilities.sizes.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="bench-param-field bench-param-field-narrow">
                <span className="bench-param-label">宽</span>
                <input
                  aria-label="宽度"
                  className="bench-param-input"
                  inputMode="numeric"
                  type="number"
                  value={params.width}
                  onChange={(event) =>
                    onParamsChange({ width: Number(event.target.value) || 0 })
                  }
                />
              </label>
              <label className="bench-param-field bench-param-field-narrow">
                <span className="bench-param-label">高</span>
                <input
                  aria-label="高度"
                  className="bench-param-input"
                  inputMode="numeric"
                  type="number"
                  value={params.height}
                  onChange={(event) =>
                    onParamsChange({ height: Number(event.target.value) || 0 })
                  }
                />
              </label>
            </>
          )}

          {capabilities.steps ? (
            <label className="bench-param-field bench-param-field-narrow">
              <span className="bench-param-label">步数</span>
              <input
                aria-label="步数"
                className="bench-param-input"
                inputMode="numeric"
                max={capabilities.steps.max}
                min={capabilities.steps.min}
                type="number"
                value={params.steps ?? capabilities.steps.default}
                onChange={(event) =>
                  onParamsChange({ steps: Number(event.target.value) || 0 })
                }
              />
            </label>
          ) : null}

          {capabilities.samplers ? (
            <label className="bench-param-field">
              <span className="bench-param-label">采样器</span>
              <select
                aria-label="采样器"
                className="bench-param-select"
                value={String(params.sampler ?? capabilities.samplers[0])}
                onChange={(event) => onParamsChange({ sampler: event.target.value })}
              >
                {capabilities.samplers.map((sampler) => (
                  <option key={sampler} value={sampler}>
                    {sampler}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {capabilities.qualities ? (
            <label className="bench-param-field">
              <span className="bench-param-label">质量</span>
              <select
                aria-label="质量"
                className="bench-param-select"
                value={String(params.quality ?? capabilities.qualities[0].id)}
                onChange={(event) => onParamsChange({ quality: event.target.value })}
              >
                {capabilities.qualities.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="bench-param-field bench-param-field-narrow">
            <span className="bench-param-label">数量</span>
            <input
              aria-label="数量"
              className="bench-param-input"
              inputMode="numeric"
              max={capabilities.maxBatch}
              min={1}
              type="number"
              value={params.count ?? 1}
              onChange={(event) =>
                onParamsChange({
                  count: Math.max(
                    1,
                    Math.min(capabilities.maxBatch, Number(event.target.value) || 1)
                  )
                })
              }
            />
          </label>
        </div>

        <div className="bench-params-row">
          <div className="bench-action-group bench-action-group-spacious">
            {saveStatusLabel ? (
              <span className="status-note" data-state={saveStatus}>
                {saveStatusLabel}
              </span>
            ) : null}
            {generateError ? (
              <span className="status-note" data-state="error">
                {generateError}
              </span>
            ) : null}
            <button
              className="secondary-button"
              disabled={!canSave || loading}
              type="button"
              onClick={onSave}
            >
              保存回提示词库
            </button>
            <button
              className="generate-button"
              disabled={loading || !content.trim()}
              type="button"
              onClick={onGenerate}
            >
              {loading ? '生成中...' : '生成'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
