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
  /** 自定义预览图，data URL（`data:image/jpeg;base64,...`）。空串 = 未设置。 */
  previewImage?: string
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
  /** 传空串清除预览图。 */
  previewImage?: string
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
