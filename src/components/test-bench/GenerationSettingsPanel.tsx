import { listImageProviders } from '../../services/image/providerRegistry'
import type { ImageGenerationParams } from '../../services/image/types'

const providers = listImageProviders()

export function GenerationSettingsPanel({ content, loading, providerId, params, onProviderChange, onParamsChange, onGenerate }: {
  content: string; loading: boolean; providerId: string; params: ImageGenerationParams
  onProviderChange: (id: string) => void; onParamsChange: (patch: Partial<ImageGenerationParams>) => void; onGenerate: () => void
}) {
  const provider = providers.find((item) => item.id === providerId) ?? providers[0]
  const caps = provider.capabilities
  const numberField = (label: string, key: 'width' | 'height' | 'steps' | 'count', min = 1, max?: number) => <label className="bench-param-field"><span>{label}</span><input aria-label={label} type="number" min={min} max={max} value={params[key] ?? ''} onChange={(e) => onParamsChange({ [key]: Number(e.target.value) || min })} /></label>
  return <div className="generation-settings">
    <h2 className="bench-section-title">生成参数</h2>
    <label className="bench-param-field"><span>服务</span><select aria-label="图像 Provider" value={providerId} onChange={(e) => onProviderChange(e.target.value)}>{providers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    {caps.sizes ? <label className="bench-param-field"><span>尺寸</span><select aria-label="尺寸" value={`${params.width}x${params.height}`} onChange={(e) => { const size = caps.sizes?.find((item) => item.id === e.target.value); if (size) onParamsChange({ width: size.width, height: size.height }) }}>{caps.sizes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label> : <div className="bench-param-pair">{numberField('宽度', 'width')}{numberField('高度', 'height')}</div>}
    {caps.steps ? numberField('步数', 'steps', caps.steps.min, caps.steps.max) : null}
    {caps.samplers ? <label className="bench-param-field"><span>采样器</span><select aria-label="采样器" value={String(params.sampler ?? caps.samplers[0])} onChange={(e) => onParamsChange({ sampler: e.target.value })}>{caps.samplers.map((item) => <option key={item}>{item}</option>)}</select></label> : null}
    {caps.qualities ? <label className="bench-param-field"><span>质量</span><select aria-label="质量" value={String(params.quality ?? caps.qualities[0].id)} onChange={(e) => onParamsChange({ quality: e.target.value })}>{caps.qualities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label> : null}
    {numberField('数量', 'count', 1, caps.maxBatch)}
    <button className="generate-button generation-settings-action" disabled={loading || !content.trim()} type="button" onClick={onGenerate}>{loading ? '生成中...' : '生成'}</button>
  </div>
}
