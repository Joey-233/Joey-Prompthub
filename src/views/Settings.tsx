import { useEffect, useMemo, useRef, useState } from 'react'

import { ProviderSelect } from '../components/settings/ProviderSelect'
import { SecretField } from '../components/settings/SecretField'
import { SettingsSection } from '../components/settings/SettingsSection'
import { AI_PRESETS, findAiPreset } from '../services/ai/presets'

type SettingsMap = Record<string, unknown>
type SaveState = {
  state: 'idle' | 'saving' | 'saved' | 'error'
  value?: unknown
  batch?: Array<[string, unknown]>
}

const defaults: SettingsMap = {
  ai_preset: 'doubao',
  ai_base_url: 'https://ark.cn-beijing.volces.com/api/v3',
  ai_model: 'doubao-seed-evolving'
}
const textSettingKeys = ['ai_preset', 'ai_base_url', 'ai_model'] as const

function normalizeLoadedSettings(loaded: SettingsMap): SettingsMap {
  const presetId = String(loaded.ai_preset ?? defaults.ai_preset)
  const visiblePreset = AI_PRESETS.some((preset) => preset.id === presetId)

  return {
    ...loaded,
    ai_preset: visiblePreset ? presetId : 'custom'
  }
}

export function Settings() {
  const [settings, setSettings] = useState<SettingsMap>(defaults)
  const [statuses, setStatuses] = useState<Record<string, SaveState>>({})
  const [aiKeyConfigured, setAiKeyConfigured] = useState<boolean | null>(null)
  const [checkResult, setCheckResult] = useState<{
    fingerprint: string
    message: string
    checking?: boolean
  } | null>(null)
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([])
  const edited = useRef(new Set<string>())
  const versions = useRef<Record<string, number>>({})
  const operationQueue = useRef<Promise<void>>(Promise.resolve())

  function enqueue(operation: () => Promise<void>) {
    const write = operationQueue.current.catch(() => undefined).then(operation)
    operationQueue.current = write
    return write
  }

  useEffect(() => {
    let mounted = true
    void window.promptHub.settings
      .list()
      .then((loaded) => {
        if (!mounted) return
        setSettings((current) => {
          const safe = Object.fromEntries(
            Object.entries(normalizeLoadedSettings(loaded)).filter(
              ([key]) => !edited.current.has(key)
            )
          )
          return { ...current, ...safe }
        })
      })
      .catch(() => undefined)
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    void window.promptHub.secure
      .has('ai.apiKey')
      .then((configured) => {
        if (mounted) setAiKeyConfigured(configured)
      })
      .catch(() => {
        if (mounted) setAiKeyConfigured(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  async function persist(key: string, value: unknown) {
    edited.current.add(key)
    setSettings((current) => ({ ...current, [key]: value }))
    const version = (versions.current[key] ?? 0) + 1
    versions.current[key] = version
    setStatuses((current) => ({ ...current, [key]: { state: 'saving', value } }))

    try {
      await enqueue(() => window.promptHub.settings.set(key, value))
      if (versions.current[key] === version)
        setStatuses((current) => ({ ...current, [key]: { state: 'saved', value } }))
    } catch {
      if (versions.current[key] === version)
        setStatuses((current) => ({ ...current, [key]: { state: 'error', value } }))
    }
  }

  async function persistMany(values: SettingsMap) {
    const batch = Object.entries(values)
    const batchVersions: Record<string, number> = {}
    setSettings((current) => ({ ...current, ...values }))

    for (const [key, value] of batch) {
      edited.current.add(key)
      batchVersions[key] = (versions.current[key] ?? 0) + 1
      versions.current[key] = batchVersions[key]
      setStatuses((current) => ({ ...current, [key]: { state: 'saving', value, batch } }))
    }

    try {
      await enqueue(async () => {
        const failures: unknown[] = []
        for (const [key, value] of batch) {
          try {
            await window.promptHub.settings.set(key, value)
          } catch (error) {
            failures.push(error)
          }
        }
        if (failures.length) throw new AggregateError(failures, 'Failed settings batch')
      })
      setStatuses((current) => {
        const next = { ...current }
        for (const [key, value] of batch)
          if (versions.current[key] === batchVersions[key]) next[key] = { state: 'saved', value }
        return next
      })
    } catch {
      setStatuses((current) => {
        const next = { ...current }
        for (const [key, value] of batch)
          if (versions.current[key] === batchVersions[key])
            next[key] = { state: 'error', value, batch }
        return next
      })
    }
  }

  function handlePreset(id: string) {
    const preset = findAiPreset(id)
    const values: SettingsMap = { ai_preset: id }
    if (!preset.baseUrlEditable) {
      values.ai_base_url = preset.baseURL
      values.ai_model = preset.defaultModel
    }
    void persistMany(values)
  }

  const preset = useMemo(() => findAiPreset(String(settings.ai_preset)), [settings.ai_preset])
  const modelSuggestions = [...new Set([...preset.suggestedModels, ...discoveredModels])]
  const activeStates = textSettingKeys.map((key) => statuses[key]).filter(Boolean)
  const saveState = activeStates.some((item) => item.state === 'error')
    ? 'error'
    : activeStates.some((item) => item.state === 'saving')
      ? 'saving'
      : activeStates.some((item) => item.state === 'saved')
        ? 'saved'
        : 'idle'
  const failed = textSettingKeys
    .map((key) => [key, statuses[key]] as const)
    .find(([, value]) => value?.state === 'error')
  const fingerprint = JSON.stringify([
    settings.ai_preset,
    settings.ai_base_url,
    settings.ai_model,
    aiKeyConfigured
  ])

  const retryFailed = () => {
    if (!failed) return
    if (failed[1].batch) void persistMany(Object.fromEntries(failed[1].batch))
    else void persist(failed[0], failed[1].value)
  }

  const statusNode =
    saveState === 'error' ? (
      <button type="button" className="settings-retry" onClick={retryFailed}>
        保存失败，点击重试
      </button>
    ) : (
      <span>
        {saveState === 'saving' ? '保存中…' : saveState === 'saved' ? '已保存' : '自动保存'}
      </span>
    )

  async function checkConnection() {
    const missing = [
      !String(settings.ai_base_url).trim() && 'Base URL',
      !String(settings.ai_model).trim() && '模型',
      !aiKeyConfigured && 'API Key'
    ].filter(Boolean)

    if (missing.length) {
      setCheckResult({ fingerprint, message: `缺少：${missing.join('、')}` })
      return
    }

    setCheckResult({ fingerprint, message: '正在连接服务…', checking: true })
    try {
      const result = await window.promptHub.ai.checkConnection('ai')
      setDiscoveredModels(result.models)
      setCheckResult({ fingerprint, message: result.message })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.replace(/^Error invoking remote method '[^']+': /, '')
          : '连接失败'
      setCheckResult({ fingerprint, message })
    }
  }

  const visibleCheckResult = checkResult?.fingerprint === fingerprint ? checkResult : null

  return (
    <main className="settings-page" aria-label="文字 API 设置">
      <div className="settings-page-intro">
        <div>
          <span className="settings-kicker">OPENAI COMPATIBLE</span>
          <h2>文字 API</h2>
          <p>提示词优化只使用这一套文字接口。选择官方预设后会自动填入地址和模型。</p>
        </div>
        <span className="settings-protocol-badge">Chat Completions</span>
      </div>

      <SettingsSection
        title="服务配置"
        description="应用不内置任何 API Key。请使用你自己的密钥，密钥仅加密保存在本机。"
        status={statusNode}
      >
        <div className="settings-form-grid">
          <ProviderSelect
            label="服务商预设"
            value={String(settings.ai_preset)}
            options={AI_PRESETS.map(({ id, label }) => ({ id, label }))}
            onChange={handlePreset}
          />
          <label className="field">
            <span className="field-label">API Base URL</span>
            <input
              className="field-input"
              readOnly={!preset.baseUrlEditable}
              value={String(settings.ai_base_url)}
              onChange={(event) => void persist('ai_base_url', event.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">模型</span>
          <input
            className="field-input"
            list="text-model-suggestions"
            value={String(settings.ai_model)}
            onChange={(event) => void persist('ai_model', event.target.value)}
          />
          <datalist id="text-model-suggestions">
            {modelSuggestions.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </label>

        {preset.suggestedModels.length > 0 ? (
          <div className="settings-model-options" aria-label="模型快捷选择">
            {preset.suggestedModels.map((model) => (
              <button
                key={model}
                type="button"
                data-active={String(settings.ai_model) === model}
                onClick={() => void persist('ai_model', model)}
              >
                {model}
              </button>
            ))}
          </div>
        ) : null}

        <SecretField
          label="API Key"
          storageKey="ai.apiKey"
          actionLabel="保存 API Key"
          knownConfigured={aiKeyConfigured}
          onConfiguredChange={setAiKeyConfigured}
        />

        {preset.note ? <p className="settings-provider-note">{preset.note}</p> : null}

        <div className="settings-connection-row">
          <button
            type="button"
            className="editor-action editor-action-primary"
            disabled={visibleCheckResult?.checking}
            onClick={() => void checkConnection()}
          >
            {visibleCheckResult?.checking ? '检查中…' : '检查连接'}
          </button>
          {visibleCheckResult ? <p role="status">{visibleCheckResult.message}</p> : null}
        </div>
      </SettingsSection>
    </main>
  )
}
