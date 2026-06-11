import { useEffect, useMemo, useState } from 'react'

import { ImportExportPanel } from '../components/settings/ImportExportPanel'
import { ProviderSelect } from '../components/settings/ProviderSelect'
import { SecretField } from '../components/settings/SecretField'
import { SettingsSection } from '../components/settings/SettingsSection'
import { AI_PRESETS, findAiPreset } from '../services/ai/presets'
import { IMAGE_PRESETS, findImagePreset } from '../services/ai/presets'

type SettingsMap = Record<string, unknown>

export function Settings() {
  const [settings, setSettings] = useState<SettingsMap>({
    ai_preset: 'openai',
    ai_base_url: '',
    ai_model: 'gpt-4.1-mini',
    vision_preset: 'follow',
    vision_base_url: '',
    vision_model: '',
    image_preset: 'openai-image',
    image_base_url: '',
    image_model: 'gpt-image-1',
    theme_mode: 'system',
    launch_at_login: false
  })

  useEffect(() => {
    void window.promptHub.settings.list().then((value) => {
      setSettings((current) => ({ ...current, ...value }))
    })
  }, [])

  async function updateSetting(key: string, value: unknown) {
    setSettings((current) => ({ ...current, [key]: value }))
    await window.promptHub.settings.set(key, value)
  }

  // 切换 AI 预设：自动把 baseURL / 默认模型回填，自定义预设保留用户已填值
  async function handleAiPresetChange(presetId: string) {
    const preset = findAiPreset(presetId)
    setSettings((current) => ({
      ...current,
      ai_preset: presetId,
      ai_base_url: preset.baseUrlEditable
        ? String(current.ai_base_url ?? '')
        : preset.baseURL,
      ai_model: preset.defaultModel || String(current.ai_model ?? '')
    }))
    await window.promptHub.settings.set('ai_preset', presetId)
    if (!preset.baseUrlEditable) {
      await window.promptHub.settings.set('ai_base_url', preset.baseURL)
    }
    if (preset.defaultModel) {
      await window.promptHub.settings.set('ai_model', preset.defaultModel)
    }
  }

  // 切换识图服务来源：'follow' = 跟随 AI 服务；选具体预设时回填 baseURL
  // 和该预设的首个视觉模型建议（文本 defaultModel 大多不带视觉，不能直接用）
  async function handleVisionPresetChange(presetId: string) {
    const preset = presetId === 'follow' ? null : findAiPreset(presetId)
    const seededModel = preset?.suggestedVisionModels?.[0] ?? ''

    setSettings((current) => ({
      ...current,
      vision_preset: presetId,
      vision_base_url: preset
        ? preset.baseUrlEditable
          ? String(current.vision_base_url ?? '')
          : preset.baseURL
        : String(current.vision_base_url ?? ''),
      vision_model: seededModel || String(current.vision_model ?? '')
    }))
    await window.promptHub.settings.set('vision_preset', presetId)
    if (preset && !preset.baseUrlEditable) {
      await window.promptHub.settings.set('vision_base_url', preset.baseURL)
    }
    if (seededModel) {
      await window.promptHub.settings.set('vision_model', seededModel)
    }
  }

  async function handleImagePresetChange(presetId: string) {
    const preset = findImagePreset(presetId)
    setSettings((current) => ({
      ...current,
      image_preset: presetId,
      image_base_url: preset.baseUrlEditable
        ? String(current.image_base_url ?? '')
        : preset.baseURL ?? '',
      image_model: preset.defaultModel || String(current.image_model ?? '')
    }))
    await window.promptHub.settings.set('image_preset', presetId)
    if (preset.baseURL && !preset.baseUrlEditable) {
      await window.promptHub.settings.set('image_base_url', preset.baseURL)
    }
    if (preset.defaultModel) {
      await window.promptHub.settings.set('image_model', preset.defaultModel)
    }
  }

  const aiPresetId = String(settings.ai_preset ?? 'openai')
  const aiPreset = useMemo(() => findAiPreset(aiPresetId), [aiPresetId])
  const visionPresetId = String(settings.vision_preset ?? 'follow')
  const visionFollowsAi = visionPresetId === 'follow'
  const visionPreset = useMemo(
    () => (visionPresetId === 'follow' ? null : findAiPreset(visionPresetId)),
    [visionPresetId]
  )
  const imagePresetId = String(settings.image_preset ?? 'openai-image')
  const imagePreset = useMemo(() => findImagePreset(imagePresetId), [imagePresetId])

  const aiBaseUrlPlaceholder = aiPreset.baseURL || 'https://api.example.com/v1'
  const imageBaseUrlPlaceholder = imagePreset.baseURL || 'https://api.example.com/v1'
  // 跟随模式下的模型建议取自当前 AI 服务的视觉清单
  const visionModelSuggestions = visionFollowsAi
    ? aiPreset.suggestedVisionModels ?? []
    : visionPreset?.suggestedVisionModels ?? []

  return (
    <section className="settings-layout">
      <header className="view-heading">
        <span className="view-eyebrow">Preferences</span>
        <div>
          <h2 className="view-title">设置</h2>
          <p className="view-description">
            配置 AI 服务、图像 provider、本地备份和桌面应用行为。
          </p>
        </div>
      </header>

      <SettingsSection
        title="AI 服务"
        description="所有厂商都走 OpenAI 兼容协议（baseURL + apiKey + model）。下拉选预设会自动填好 baseURL 和默认模型，也可以选「自定义」接入任意 OpenAI 兼容端点。"
      >
        <ProviderSelect
          label="服务商预设"
          value={aiPresetId}
          options={AI_PRESETS.map((preset) => ({ id: preset.id, label: preset.label }))}
          onChange={(value) => void handleAiPresetChange(value)}
        />
        <label className="field">
          <span className="field-label">API Base URL</span>
          <input
            className="field-input"
            placeholder={aiBaseUrlPlaceholder}
            disabled={!aiPreset.baseUrlEditable && Boolean(aiPreset.baseURL)}
            value={String(settings.ai_base_url ?? '')}
            onChange={(event) => void updateSetting('ai_base_url', event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">默认模型</span>
          <input
            className="field-input"
            list="ai-model-suggestions"
            placeholder={aiPreset.defaultModel || '填写模型 ID'}
            value={String(settings.ai_model ?? '')}
            onChange={(event) => void updateSetting('ai_model', event.target.value)}
          />
          <datalist id="ai-model-suggestions">
            {aiPreset.suggestedModels.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </label>
        {aiPreset.note ? <p className="field-hint">{aiPreset.note}</p> : null}
        <p className="field-hint">
          保存后将用于：<b>{aiPreset.label}</b> · 模型{' '}
          <code>
            {String(settings.ai_model ?? '').trim() || aiPreset.defaultModel || '未填写'}
          </code>
        </p>
        <SecretField label="API Key" storageKey="ai.apiKey" actionLabel="保存 API Key" />
      </SettingsSection>

      <SettingsSection
        title="识图（视觉模型）"
        description="快速录入的「识图」功能用这里的配置。默认跟随上面的 AI 服务，只需指定一个支持图片输入的模型；也可以完全独立接另一家。"
      >
        <ProviderSelect
          label="识图服务来源"
          value={visionPresetId}
          options={[
            { id: 'follow', label: '跟随 AI 服务' },
            ...AI_PRESETS.map((preset) => ({ id: preset.id, label: preset.label }))
          ]}
          onChange={(value) => void handleVisionPresetChange(value)}
        />
        {!visionFollowsAi && visionPreset ? (
          <label className="field">
            <span className="field-label">识图 API Base URL</span>
            <input
              className="field-input"
              placeholder={visionPreset.baseURL || 'https://api.example.com/v1'}
              disabled={!visionPreset.baseUrlEditable && Boolean(visionPreset.baseURL)}
              value={String(settings.vision_base_url ?? '')}
              onChange={(event) => void updateSetting('vision_base_url', event.target.value)}
            />
          </label>
        ) : null}
        <label className="field">
          <span className="field-label">识图模型</span>
          <input
            className="field-input"
            list="vision-model-suggestions"
            placeholder={
              visionModelSuggestions[0] ||
              (visionFollowsAi ? '留空 = 用 AI 服务的默认模型' : 'gpt-4o / qwen-vl-plus ...')
            }
            value={String(settings.vision_model ?? '')}
            onChange={(event) => void updateSetting('vision_model', event.target.value)}
          />
          <datalist id="vision-model-suggestions">
            {visionModelSuggestions.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </label>
        {visionFollowsAi ? (
          <p className="field-hint">
            跟随模式复用 AI 服务的 baseURL 和 Key。若上面填的是纯文本模型（如
            deepseek-chat），这里务必填一个视觉模型（如 gpt-4o），否则识图会报错。
          </p>
        ) : (
          <>
            {visionPreset?.note ? <p className="field-hint">{visionPreset.note}</p> : null}
            <p className="field-hint">
              识图 Key 留空时自动复用 AI 服务的 Key（适合同厂商/中转共用一个 Key 的情况）。
            </p>
            <SecretField
              label="识图 API Key（可留空）"
              storageKey="vision.apiKey"
              actionLabel="保存识图 Key"
            />
          </>
        )}
      </SettingsSection>

      <SettingsSection
        title="图像服务"
        description="测试台默认走这里选的 provider。OpenAI 系预设与上面 AI 服务共用同一个 API Key（ai.apiKey）。"
      >
        <ProviderSelect
          label="服务商预设"
          value={imagePresetId}
          options={IMAGE_PRESETS.map((preset) => ({ id: preset.id, label: preset.label }))}
          onChange={(value) => void handleImagePresetChange(value)}
        />
        {imagePreset.kind === 'openai' ? (
          <>
            <label className="field">
              <span className="field-label">API Base URL</span>
              <input
                className="field-input"
                placeholder={imageBaseUrlPlaceholder}
                disabled={!imagePreset.baseUrlEditable && Boolean(imagePreset.baseURL)}
                value={String(settings.image_base_url ?? '')}
                onChange={(event) => void updateSetting('image_base_url', event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">图像模型</span>
              <input
                className="field-input"
                list="image-model-suggestions"
                placeholder={imagePreset.defaultModel || 'gpt-image-1'}
                value={String(settings.image_model ?? '')}
                onChange={(event) => void updateSetting('image_model', event.target.value)}
              />
              <datalist id="image-model-suggestions">
                {(imagePreset.suggestedModels ?? []).map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </label>
          </>
        ) : null}
        {imagePreset.kind === 'sd-webui' ? (
          <label className="field">
            <span className="field-label">SD WebUI 地址</span>
            <input
              className="field-input"
              placeholder={imagePreset.baseURL || 'http://127.0.0.1:7860'}
              value={String(settings.image_base_url ?? '')}
              onChange={(event) => void updateSetting('image_base_url', event.target.value)}
            />
          </label>
        ) : null}
        {imagePreset.note ? <p className="field-hint">{imagePreset.note}</p> : null}
      </SettingsSection>

      <SettingsSection title="数据与备份" description="导入导出当前提示词库和非敏感设置。">
        <ImportExportPanel />
      </SettingsSection>

      <SettingsSection title="系统与外观" description="控制主题和随系统启动行为。">
        <ProviderSelect
          label="主题模式"
          value={String(settings.theme_mode)}
          options={[
            { id: 'light', label: '亮色' },
            { id: 'dark', label: '暗色' },
            { id: 'system', label: '跟随系统' }
          ]}
          onChange={(value) => void updateSetting('theme_mode', value)}
        />
        <label className="settings-toggle">
          <input
            checked={Boolean(settings.launch_at_login)}
            type="checkbox"
            onChange={(event) => {
              const checked = event.target.checked
              void updateSetting('launch_at_login', checked)
              void window.promptHub.system.setLaunchAtLogin(checked)
            }}
          />
          <span>开机自启</span>
        </label>
      </SettingsSection>
    </section>
  )
}
