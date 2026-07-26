/**
 * 文本 AI 服务预设。所有预设都假设服务对外暴露 OpenAI Chat Completions 兼容接口，
 * 选定预设后会自动填充 baseURL 和默认模型；用户随后可改 model 字段，
 * 或选「自定义」单独填 baseURL。
 *
 * suggestedModels 只是 UI 上的快速选择项，最终发请求的是 settings.ai_model。
 */
export interface AiPreset {
  id: string
  label: string
  baseURL: string
  defaultModel: string
  suggestedModels: string[]
  /** 是否允许用户编辑 baseURL（自定义预设为 true，其余固定）。 */
  baseUrlEditable?: boolean
  /** UI 提示文案。 */
  note?: string
}

export const AI_PRESETS: AiPreset[] = [
  {
    id: 'doubao',
    label: '豆包（火山方舟）',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-seed-evolving',
    suggestedModels: ['doubao-seed-evolving', 'doubao-seed-2.1-pro', 'doubao-seed-2.1-turbo'],
    note: '火山方舟官方 OpenAI 兼容接口；API Key 需要用户自行在方舟控制台申请。'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    suggestedModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    note: 'DeepSeek 官方 OpenAI 兼容接口；V4 Flash 与 V4 Pro 为当前正式模型。'
  },
  {
    id: 'custom',
    label: '自定义（OpenAI 兼容）',
    baseURL: '',
    defaultModel: '',
    suggestedModels: [],
    baseUrlEditable: true,
    note: '填写任意 OpenAI Chat Completions 兼容地址与对应模型。'
  }
]

// 仅用于无损读取旧版本已经保存的配置，不在设置页展示。
const LEGACY_AI_PRESETS: AiPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI（旧配置）',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini',
    suggestedModels: ['gpt-4.1-mini']
  },
  {
    id: 'anthropic',
    label: 'Anthropic（旧配置）',
    baseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4',
    suggestedModels: ['claude-sonnet-4']
  },
  {
    id: 'kimi',
    label: 'Kimi（旧配置）',
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-128k',
    suggestedModels: ['moonshot-v1-128k']
  },
  {
    id: 'glm',
    label: 'GLM（旧配置）',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    suggestedModels: ['glm-4-plus']
  },
  {
    id: 'qwen',
    label: 'Qwen（旧配置）',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    suggestedModels: ['qwen-plus']
  },
  {
    id: 'gemini',
    label: 'Gemini（旧配置）',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    suggestedModels: ['gemini-2.5-flash']
  }
]

export function findAiPreset(id: string | undefined | null): AiPreset {
  return (
    AI_PRESETS.find((preset) => preset.id === id) ??
    LEGACY_AI_PRESETS.find((preset) => preset.id === id) ??
    AI_PRESETS[0]
  )
}
