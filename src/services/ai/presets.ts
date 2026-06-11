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
  /** 支持图片输入的模型建议（识图功能用）。空数组 = 该厂商暂无视觉模型。 */
  suggestedVisionModels?: string[]
  /** 是否允许用户编辑 baseURL（自定义预设为 true，其余固定）。 */
  baseUrlEditable?: boolean
  /** UI 提示文案。 */
  note?: string
}

export const AI_PRESETS: AiPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini',
    suggestedModels: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o4-mini'],
    suggestedVisionModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini']
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    baseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-5',
    suggestedModels: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    suggestedVisionModels: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
    note: 'Anthropic 提供的 OpenAI 兼容端点（/v1/chat/completions）'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    suggestedModels: ['deepseek-chat', 'deepseek-reasoner'],
    suggestedVisionModels: [],
    note: 'DeepSeek 开放平台暂无视觉模型，识图请独立接其他服务'
  },
  {
    id: 'kimi',
    label: '月之暗面 Kimi',
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'kimi-k2-0905-preview',
    suggestedModels: ['kimi-k2-0905-preview', 'moonshot-v1-8k', 'moonshot-v1-32k'],
    suggestedVisionModels: ['kimi-latest', 'moonshot-v1-8k-vision-preview', 'moonshot-v1-32k-vision-preview']
  },
  {
    id: 'glm',
    label: '智谱 GLM',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4.6',
    suggestedModels: ['glm-4.6', 'glm-4-plus', 'glm-4-air'],
    suggestedVisionModels: ['glm-4v-plus', 'glm-4v', 'glm-4v-flash']
  },
  {
    id: 'qwen',
    label: '通义千问 Qwen',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    suggestedModels: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3-235b-a22b'],
    suggestedVisionModels: ['qwen-vl-max', 'qwen-vl-plus', 'qwen2.5-vl-72b-instruct']
  },
  {
    id: 'doubao',
    label: '豆包（火山方舟）',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-seed-1.6',
    suggestedModels: ['doubao-seed-1.6', 'doubao-1.5-pro-32k', 'doubao-pro-32k'],
    suggestedVisionModels: ['doubao-1.5-vision-pro-32k', 'doubao-1.5-vision-lite'],
    note: '可填模型 ID 或接入点 ep-xxxxxxxx-xxxxx'
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-pro',
    suggestedModels: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    suggestedVisionModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    note: 'Gemini 提供的 OpenAI 兼容端点'
  },
  {
    id: 'custom',
    label: '自定义（OpenAI 兼容）',
    baseURL: '',
    defaultModel: '',
    suggestedModels: [],
    suggestedVisionModels: [],
    baseUrlEditable: true,
    note: '任意 OpenAI 兼容端点：vLLM、Ollama、LiteLLM、第三方中转都行'
  }
]

export function findAiPreset(id: string | undefined | null): AiPreset {
  return AI_PRESETS.find((preset) => preset.id === id) ?? AI_PRESETS[0]
}

/**
 * 图像服务预设。OpenAI 系（DALL·E 3 / gpt-image-1）和 SD WebUI 是两类不同协议，
 * 这里给 OpenAI 系准备 baseURL 可改的预设供 Azure / 中转使用，SD WebUI 走自己的本机地址。
 */
export interface ImagePreset {
  id: string
  label: string
  /** 走哪种协议: OpenAI 兼容 / SD WebUI / Mock。 */
  kind: 'openai' | 'sd-webui' | 'mock'
  baseURL?: string
  defaultModel?: string
  suggestedModels?: string[]
  baseUrlEditable?: boolean
  note?: string
}

export const IMAGE_PRESETS: ImagePreset[] = [
  {
    id: 'openai-image',
    label: 'OpenAI 图像（DALL·E 3 / gpt-image-1）',
    kind: 'openai',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-image-1',
    suggestedModels: ['gpt-image-1', 'dall-e-3']
  },
  {
    id: 'openai-compatible-image',
    label: '自定义（OpenAI 兼容图像）',
    kind: 'openai',
    baseURL: '',
    defaultModel: 'gpt-image-1',
    suggestedModels: ['gpt-image-1', 'dall-e-3'],
    baseUrlEditable: true,
    note: 'Azure OpenAI、各类中转、自建 OpenAI 兼容图像服务'
  },
  {
    id: 'sd-webui',
    label: 'Stable Diffusion WebUI（本机）',
    kind: 'sd-webui',
    baseURL: 'http://127.0.0.1:7860',
    baseUrlEditable: true,
    note: 'A1111/Forge WebUI 的 /sdapi/v1 接口'
  },
  {
    id: 'mock-image',
    label: 'Mock（占位调试）',
    kind: 'mock',
    note: '不调真实接口，本地随机生成占位图，用于演示流程'
  }
]

export function findImagePreset(id: string | undefined | null): ImagePreset {
  return IMAGE_PRESETS.find((preset) => preset.id === id) ?? IMAGE_PRESETS[0]
}
