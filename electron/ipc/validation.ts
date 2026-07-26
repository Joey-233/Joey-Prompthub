import type {
  CreateGenerationInput,
  CreatePromptInput,
  PromptFilter,
  PromptHubBackupV1,
  Seedance2PresetInput,
  Seedance2TemplateInput,
  UpdatePromptInput
} from '../../src/shared/types'

export const ALLOWED_SECRET_KEYS = new Set(['ai.apiKey'])
export const ALLOWED_SETTING_KEYS = new Set([
  'ai_preset',
  'ai_base_url',
  'ai_model',
  'theme_mode',
  'launch_at_login',
  'floating_enabled',
  'seedance2_default_template_id'
])
const LEGACY_SETTING_KEYS = new Set([
  'vision_preset',
  'vision_base_url',
  'vision_model',
  'image_preset',
  'image_base_url',
  'image_model'
])

const MAX_TEXT = 100_000
const MAX_IMAGE_DATA_URL = 12 * 1024 * 1024

export function asRecord(value: unknown, label = '参数'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}格式不正确`)
  }
  return value as Record<string, unknown>
}

export function asString(
  value: unknown,
  label: string,
  options: { min?: number; max?: number; trim?: boolean } = {}
) {
  if (typeof value !== 'string') throw new Error(`${label}必须是文本`)
  const result = options.trim === false ? value : value.trim()
  if (result.length < (options.min ?? 0)) throw new Error(`${label}不能为空`)
  if (result.length > (options.max ?? MAX_TEXT)) throw new Error(`${label}过长`)
  return result
}

export function asId(value: unknown) {
  const id = asString(value, 'ID', { min: 1, max: 128 })
  if (!/^[\w-]+$/u.test(id)) throw new Error('ID 格式不正确')
  return id
}

export function asBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label}必须是布尔值`)
  return value
}

function asStringArray(value: unknown, label: string, maxItems: number, maxLength: number) {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${label}格式不正确`)
  return value.map((item) => asString(item, label, { min: 1, max: maxLength }))
}

function validateImages(value: unknown) {
  if (!Array.isArray(value) || value.length > 3) throw new Error('预览图最多 3 张')
  return value.map((item) => {
    const image = asString(item, '预览图', { min: 1, max: MAX_IMAGE_DATA_URL, trim: false })
    if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(image)) {
      throw new Error('预览图仅支持 PNG、JPEG 或 WebP')
    }
    return image
  })
}

export function validatePromptFilter(value: unknown): PromptFilter | undefined {
  if (value === undefined) return undefined
  const record = asRecord(value, '筛选条件')
  const filter: PromptFilter = {}
  if (record.search !== undefined) filter.search = asString(record.search, '搜索词', { max: 200 })
  if (record.tag !== undefined)
    filter.tag = record.tag === null ? null : asString(record.tag, '标签', { max: 40 })
  if (record.sort !== undefined) {
    const sort = asString(record.sort, '排序', { max: 30 })
    if (!['default', 'recent-used', 'favorites', 'recent-generated'].includes(sort))
      throw new Error('排序方式不正确')
    filter.sort = sort as PromptFilter['sort']
  }
  for (const key of ['limit', 'offset'] as const) {
    if (record[key] !== undefined) {
      if (!Number.isInteger(record[key]) || Number(record[key]) < 0)
        throw new Error(`${key} 格式不正确`)
      filter[key] = Number(record[key])
    }
  }
  return filter
}

export function validateCreatePrompt(value: unknown): CreatePromptInput {
  const record = asRecord(value, '提示词')
  const input: CreatePromptInput = {
    content: asString(record.content, '提示词内容', { min: 1 })
  }
  if (record.title !== undefined) input.title = asString(record.title, '标题', { max: 200 })
  if (record.notes !== undefined)
    input.notes = asString(record.notes, '备注', { max: 20_000, trim: false })
  if (record.tags !== undefined) input.tags = asStringArray(record.tags, '标签', 20, 40)
  if (record.previewImages !== undefined) input.previewImages = validateImages(record.previewImages)
  if (record.previewImage !== undefined)
    input.previewImage = validateImages([record.previewImage])[0]
  if (record.isFavorite !== undefined) input.isFavorite = asBoolean(record.isFavorite, '收藏状态')
  if (record.params !== undefined) input.params = asRecord(record.params, '生成参数')
  return input
}

export function validateUpdatePrompt(value: unknown) {
  const payload = asRecord(value, '更新参数')
  const patch = asRecord(payload.patch, '更新内容')
  const allowed = new Set([
    'title',
    'content',
    'notes',
    'tags',
    'params',
    'previewImage',
    'previewImages',
    'isFavorite',
    'lastUsedAt',
    'lastGeneratedAt',
    'useCount'
  ])
  for (const key of Object.keys(patch))
    if (!allowed.has(key)) throw new Error(`不支持的更新字段：${key}`)

  const validated: UpdatePromptInput = {}
  if (patch.title !== undefined) validated.title = asString(patch.title, '标题', { max: 200 })
  if (patch.content !== undefined)
    validated.content = asString(patch.content, '提示词内容', { min: 1 })
  if (patch.notes !== undefined)
    validated.notes = asString(patch.notes, '备注', { max: 20_000, trim: false })
  if (patch.tags !== undefined) validated.tags = asStringArray(patch.tags, '标签', 20, 40)
  if (patch.params !== undefined) validated.params = asRecord(patch.params, '生成参数')
  if (patch.previewImages !== undefined)
    validated.previewImages = validateImages(patch.previewImages)
  if (patch.previewImage !== undefined)
    validated.previewImage =
      patch.previewImage === '' ? '' : validateImages([patch.previewImage])[0]
  if (patch.isFavorite !== undefined) validated.isFavorite = asBoolean(patch.isFavorite, '收藏状态')
  for (const key of ['lastUsedAt', 'lastGeneratedAt'] as const) {
    if (patch[key] !== undefined)
      validated[key] = patch[key] === null ? null : asString(patch[key], key, { max: 40 })
  }
  if (patch.useCount !== undefined) {
    if (!Number.isInteger(patch.useCount) || Number(patch.useCount) < 0)
      throw new Error('使用次数格式不正确')
    validated.useCount = Number(patch.useCount)
  }
  return { id: asId(payload.id), patch: validated }
}

export function validateGeneration(value: unknown): CreateGenerationInput {
  const record = asRecord(value, '生成记录')
  const status = asString(record.status, '生成状态', { max: 16 })
  if (!['mocked', 'success', 'failed'].includes(status)) throw new Error('生成状态不正确')
  return {
    runId: record.runId === undefined ? undefined : asId(record.runId),
    promptId: record.promptId == null ? null : asId(record.promptId),
    providerId: asString(record.providerId, '服务商', { min: 1, max: 80 }),
    status: status as CreateGenerationInput['status'],
    promptTitleSnapshot: asString(record.promptTitleSnapshot, '标题快照', { max: 200 }),
    promptSnapshot: asString(record.promptSnapshot, '提示词快照', { min: 1 }),
    imageData: asString(record.imageData, '图片数据', { max: MAX_IMAGE_DATA_URL, trim: false }),
    errorMessage:
      record.errorMessage === undefined
        ? undefined
        : asString(record.errorMessage, '失败原因', { max: 1_000 }),
    durationMs:
      record.durationMs == null
        ? null
        : Number.isFinite(record.durationMs) && Number(record.durationMs) >= 0
          ? Math.round(Number(record.durationMs))
          : (() => {
              throw new Error('请求耗时格式不正确')
            })(),
    params: record.params === undefined ? {} : asRecord(record.params, '生成参数')
  }
}

export function validateSetting(keyValue: unknown, value: unknown) {
  const key = asString(keyValue, '设置键', { min: 1, max: 80 })
  if (!ALLOWED_SETTING_KEYS.has(key)) throw new Error(`不支持的设置：${key}`)
  if (key === 'launch_at_login' || key === 'floating_enabled')
    return { key, value: asBoolean(value, key === 'launch_at_login' ? '开机自启' : '悬浮球开关') }
  if (key === 'theme_mode') {
    const theme = asString(value, '主题', { min: 1, max: 16 })
    if (!['light', 'dark', 'system'].includes(theme)) throw new Error('主题设置不正确')
    return { key, value: theme }
  }
  if (key === 'seedance2_default_template_id') {
    return { key, value: value === null ? null : asId(value) }
  }
  return { key, value: asString(value, '设置值', { max: 2_000, trim: false }) }
}

export function validateSecretKey(value: unknown) {
  const key = asString(value, '密钥名称', { min: 1, max: 80 })
  if (!ALLOWED_SECRET_KEYS.has(key)) throw new Error('不支持的密钥名称')
  return key
}

export function validateSecretPayload(value: unknown) {
  const record = asRecord(value, '密钥参数')
  return {
    key: validateSecretKey(record.key),
    value: asString(record.value, 'API Key', { min: 1, max: 8_192 })
  }
}

export function validateSeedanceTemplate(value: unknown): Seedance2TemplateInput {
  const record = asRecord(value, '模板')
  return {
    title: asString(record.title, '模板标题', { min: 1, max: 200 }),
    data: asRecord(record.data, '模板内容') as unknown as Seedance2TemplateInput['data']
  }
}

export function validateSeedancePreset(value: unknown): Seedance2PresetInput {
  const record = asRecord(value, '预设')
  return {
    name: asString(record.name, '预设名称', { min: 1, max: 200 }),
    tags: record.tags === undefined ? [] : asStringArray(record.tags, '标签', 20, 40),
    segment: asRecord(record.segment, '镜头片段') as unknown as Seedance2PresetInput['segment']
  }
}

function asTimestamp(value: unknown, label: string) {
  const timestamp = asString(value, label, { min: 1, max: 40 })
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error(`${label}格式不正确`)
  return timestamp
}

export function validateBackup(value: unknown): PromptHubBackupV1 {
  let serializedLength: number
  try {
    serializedLength = JSON.stringify(value).length
  } catch {
    throw new Error('备份内容无法解析')
  }
  if (serializedLength > 128 * 1024 * 1024) throw new Error('备份文件超过 128 MB 限制')
  const backup = asRecord(value, '备份')
  if (backup.format !== 'prompthub-backup' || backup.version !== 1) {
    throw new Error('仅支持 Joey Prompthub 版本 1 备份')
  }
  const arrays = asRecord(backup.seedance2, 'Seedance2 备份')
  if (
    !Array.isArray(backup.prompts) ||
    backup.prompts.length > 100_000 ||
    !Array.isArray(backup.generations) ||
    backup.generations.length > 200_000 ||
    !Array.isArray(arrays.templates) ||
    arrays.templates.length > 10_000 ||
    !Array.isArray(arrays.presets) ||
    arrays.presets.length > 50_000
  ) {
    throw new Error('备份记录数量不正确')
  }

  const prompts = backup.prompts.map((raw) => {
    const record = asRecord(raw, '提示词备份记录')
    const input = validateCreatePrompt(record)
    return {
      id: asId(record.id),
      title: input.title || asString(record.title, '标题', { min: 1, max: 200 }),
      content: input.content,
      notes: input.notes ?? '',
      tags: input.tags ?? [],
      params: input.params ?? {},
      previewImage: input.previewImages?.[0] ?? input.previewImage ?? '',
      previewImages: input.previewImages ?? (input.previewImage ? [input.previewImage] : []),
      isFavorite: asBoolean(record.isFavorite, '收藏状态'),
      lastUsedAt: record.lastUsedAt == null ? null : asTimestamp(record.lastUsedAt, '最近使用时间'),
      lastGeneratedAt:
        record.lastGeneratedAt == null ? null : asTimestamp(record.lastGeneratedAt, '最近生成时间'),
      useCount:
        Number.isInteger(record.useCount) && Number(record.useCount) >= 0
          ? Number(record.useCount)
          : 0,
      createdAt: asTimestamp(record.createdAt, '创建时间'),
      updatedAt: asTimestamp(record.updatedAt, '更新时间')
    }
  })
  const generations = backup.generations.map((raw) => {
    const record = asRecord(raw, '历史备份记录')
    const input = validateGeneration(record)
    return {
      id: asId(record.id),
      runId: input.runId ?? asId(record.id),
      promptId: input.promptId ?? null,
      providerId: input.providerId,
      status: input.status,
      promptTitleSnapshot: input.promptTitleSnapshot,
      promptSnapshot: input.promptSnapshot,
      imageData: input.imageData,
      errorMessage: input.errorMessage ?? '',
      durationMs: input.durationMs ?? null,
      params: input.params ?? {},
      createdAt: asTimestamp(record.createdAt, '生成时间')
    }
  })
  const templates = (arrays.templates as unknown[]).map((raw) => {
    const record = asRecord(raw, '模板备份记录')
    const input = validateSeedanceTemplate(record)
    return {
      id: asId(record.id),
      ...input,
      createdAt: asTimestamp(record.createdAt, '模板创建时间'),
      updatedAt: asTimestamp(record.updatedAt, '模板更新时间')
    }
  })
  const presets = (arrays.presets as unknown[]).map((raw) => {
    const record = asRecord(raw, '预设备份记录')
    const input = validateSeedancePreset(record)
    return {
      id: asId(record.id),
      ...input,
      tags: input.tags ?? [],
      createdAt: asTimestamp(record.createdAt, '预设创建时间'),
      updatedAt: asTimestamp(record.updatedAt, '预设更新时间')
    }
  })
  const rawSettings = asRecord(backup.settings, '设置备份')
  const settings: Record<string, unknown> = {}
  for (const [key, settingValue] of Object.entries(rawSettings)) {
    // 旧版测试台和独立视觉服务设置已下线。导入时忽略这些字段，
    // 既保持旧备份可读取，也避免把废弃端点重新暴露给当前版本。
    if (LEGACY_SETTING_KEYS.has(key)) continue
    const validated = validateSetting(key, settingValue)
    settings[validated.key] = validated.value
  }
  return {
    format: 'prompthub-backup',
    version: 1,
    exportedAt: asTimestamp(backup.exportedAt, '导出时间'),
    prompts,
    generations,
    settings,
    seedance2: { templates, presets },
    excludes: ['apiKeys']
  }
}
