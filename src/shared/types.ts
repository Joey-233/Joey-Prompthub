import type {
  ImageGenerationInput,
  ImageGenerationOutcome
} from '../services/image/types'

/**
 * "绘图" and "LLM" are reserved tag values that designate the primary
 * categorization of a prompt. They have no special storage — they live in the
 * regular `tags` array — but they get promoted UI treatment (chip toggles in
 * the capture form, prominent filter chips, gates the "send to test bench"
 * action).
 */
export const IMAGE_TAG = '绘图'
export const LLM_TAG = 'LLM'
export const TYPE_TAGS = [IMAGE_TAG, LLM_TAG] as const

export interface PromptRecord {
  id: string
  title: string
  content: string
  notes: string
  tags: string[]
  params: Record<string, unknown>
  /** 自定义预览图（兼容字段，= previewImages[0] 或空串）。空串 = 未设置。 */
  previewImage?: string
  /** 自定义预览图列表，最多 3 张 data URL。卡片 hover 自动轮播。 */
  previewImages?: string[]
  isFavorite: boolean
  lastUsedAt: string | null
  lastGeneratedAt: string | null
  useCount: number
  createdAt: string
  updatedAt: string
}

export interface CreatePromptInput {
  content: string
  title?: string
  notes?: string
  tags?: string[]
  params?: Record<string, unknown>
  previewImage?: string
  previewImages?: string[]
  isFavorite?: boolean
  lastUsedAt?: string | null
  lastGeneratedAt?: string | null
  useCount?: number
}

export interface UpdatePromptInput {
  title?: string
  content?: string
  notes?: string
  tags?: string[]
  params?: Record<string, unknown>
  /** 传空串清除预览图。会与 previewImages 同步：写入时若提供 previewImages 则以数组为准。 */
  previewImage?: string
  /** 自定义预览图列表，最多 3 张。传 [] 清空。 */
  previewImages?: string[]
  isFavorite?: boolean
  lastUsedAt?: string | null
  lastGeneratedAt?: string | null
  useCount?: number
}

export interface PromptFilter {
  search?: string
}

export interface GenerationRecord {
  id: string
  promptId: string | null
  providerId: string
  status: 'mocked' | 'success' | 'failed'
  promptTitleSnapshot: string
  promptSnapshot: string
  imageData: string
  params: Record<string, unknown>
  createdAt: string
}

export interface CreateGenerationInput {
  promptId?: string | null
  providerId: string
  status: GenerationRecord['status']
  promptTitleSnapshot: string
  promptSnapshot: string
  imageData: string
  params?: Record<string, unknown>
}

export interface AppSettingRecord {
  key: string
  value: unknown
}

export interface FloatingWindowState {
  x: number
  y: number
  side: 'left' | 'right'
  expanded: boolean
}

export interface MoveFloatingWindowInput {
  x: number
  y: number
  snap?: boolean
}

export interface FloatingDragStartInput {
  cursorScreenX?: number
  cursorScreenY?: number
}

export interface AiOptimizeBridgeInput {
  content: string
  direction: string
  customInstruction?: string
  model?: string
}

export interface Seedance2RefItem {
  /** 自由 emoji，比如 🖐 / 🏛 / 🧌 / 👹 / ⚔ */
  emoji: string
  /** 图片编号，比如 "图片1" 或 "图片节点 2"（生成时拼成 `${emoji}${label}`） */
  label: string
  /** 该参考图的说明文字 */
  note: string
}

export interface Seedance2RefGroup {
  /** 分组标题，例如 "主角视角参考" / "场景参考" / "角色参考" */
  title: string
  /** 标题下方的整段文字（可空）。允许穿插 `${emoji}${label}` 内联引用。 */
  description: string
  items: Seedance2RefItem[]
}

export interface Seedance2Segment {
  id: string
  /** 时间段标签，比如 "0-3s" / "镜头 1" */
  timeLabel: string
  /** 镜头类型，比如 "第一视角" / "俯瞰广角"。可空。 */
  shotType: string
  /** 主体描述，允许内嵌 `${emoji}${label}` 引用 */
  description: string
  /** 角色台词，多行，每行 `角色: "..."` 自由填写 */
  dialog: string
}

export type Seedance2TemplateSection =
  | { id: string; title: string; kind: 'text'; content: string }
  | { id: string; title: string; kind: 'references'; refGroups: Seedance2RefGroup[] }
  | { id: string; title: string; kind: 'shots'; segments: Seedance2Segment[]; footer: string }

export interface Seedance2TemplateData {
  sections: Seedance2TemplateSection[]
}

/** The JSON shape used by S2 templates before customizable sections. */
export interface Seedance2LegacyTemplateData {
  intro: string
  refGroups: Seedance2RefGroup[]
  segments: Seedance2Segment[]
  segmentsFooter: string
  style: string
}

export type Seedance2StoredTemplateData = Seedance2TemplateData | Seedance2LegacyTemplateData

export interface Seedance2TemplateRecord {
  id: string
  title: string
  data: Seedance2StoredTemplateData
  createdAt: string
  updatedAt: string
}

export interface Seedance2TemplateInput {
  title: string
  data: Seedance2TemplateData
}

export interface Seedance2PresetRecord {
  id: string
  name: string
  tags: string[]
  segment: Seedance2Segment
  createdAt: string
  updatedAt: string
}

export interface Seedance2PresetInput {
  name: string
  tags?: string[]
  segment: Seedance2Segment
}

export interface AiDescribeImageInput {
  /** 图片 data URL（`data:image/...;base64,xxx`），由渲染层压缩后传入。 */
  imageDataUrl: string
  /** 识别指令；缺省时主进程使用默认的「反推绘图提示词」指令。 */
  instruction?: string
  model?: string
}

export interface PromptHubApi {
  prompts: {
    list: (filter?: PromptFilter) => Promise<PromptRecord[]>
    create: (input: CreatePromptInput) => Promise<PromptRecord>
    update: (id: string, patch: UpdatePromptInput) => Promise<PromptRecord>
    delete: (id: string) => Promise<void>
  }
  generations: {
    list: () => Promise<GenerationRecord[]>
    create: (input: CreateGenerationInput) => Promise<GenerationRecord>
  }
  settings: {
    list: () => Promise<Record<string, unknown>>
    set: (key: string, value: unknown) => Promise<void>
  }
  secure: {
    has: (key: string) => Promise<boolean>
    set: (key: string, value: string) => Promise<void>
    delete: (key: string) => Promise<void>
    reveal: (key: string) => Promise<string | null>
  }
  ai: {
    optimize: (input: AiOptimizeBridgeInput) => Promise<string>
    describeImage: (input: AiDescribeImageInput) => Promise<string>
  }
  image: {
    openaiGenerate: (input: ImageGenerationInput) => Promise<ImageGenerationOutcome>
    sdWebuiGenerate: (input: ImageGenerationInput) => Promise<ImageGenerationOutcome>
  }
  seedance2: {
    listTemplates: () => Promise<Seedance2TemplateRecord[]>
    createTemplate: (input: Seedance2TemplateInput) => Promise<Seedance2TemplateRecord>
    updateTemplate: (id: string, patch: Seedance2TemplateInput) => Promise<Seedance2TemplateRecord>
    deleteTemplate: (id: string) => Promise<void>
    listPresets: () => Promise<Seedance2PresetRecord[]>
    createPreset: (input: Seedance2PresetInput) => Promise<Seedance2PresetRecord>
    updatePreset: (id: string, patch: Seedance2PresetInput) => Promise<Seedance2PresetRecord>
    deletePreset: (id: string) => Promise<void>
  }
  system: {
    clipboardImport: () => Promise<PromptRecord | null>
    openMainWindow: () => Promise<void>
    setLaunchAtLogin: (enabled: boolean) => Promise<void>
    quitApp: () => Promise<void>
    getFloatingState: () => Promise<FloatingWindowState>
    setFloatingExpanded: (expanded: boolean) => Promise<FloatingWindowState>
    moveFloatingWindow: (input: MoveFloatingWindowInput) => Promise<FloatingWindowState>
    floatingDragStart: (input: FloatingDragStartInput) => Promise<FloatingWindowState>
    floatingDragEnd: (snap: boolean) => Promise<FloatingWindowState>
    showFloatingContextMenu: () => Promise<void>
  }
}
