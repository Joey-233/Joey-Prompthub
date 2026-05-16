import type {
  ImageGenerationInput,
  ImageGenerationOutcome,
  ImageProvider,
  ImageSizeOption
} from './types'

const DALLE3_SIZES: ImageSizeOption[] = [
  { id: '1024x1024', label: '1024×1024 方形', width: 1024, height: 1024 },
  { id: '1792x1024', label: '1792×1024 横版', width: 1792, height: 1024 },
  { id: '1024x1792', label: '1024×1792 竖版', width: 1024, height: 1792 }
]

const GPT_IMAGE_SIZES: ImageSizeOption[] = [
  { id: '1024x1024', label: '1024×1024 方形', width: 1024, height: 1024 },
  { id: '1536x1024', label: '1536×1024 横版', width: 1536, height: 1024 },
  { id: '1024x1536', label: '1024×1536 竖版', width: 1024, height: 1536 }
]

/**
 * 渲染层只保留 capabilities 元数据，真正的 HTTP 调用全部走主进程，
 * 绕开浏览器的 CORS 限制；接入任意 OpenAI 兼容图像服务都不会被卡。
 */
export const openaiImageProvider: ImageProvider = {
  id: 'openai-image',
  label: 'OpenAI 图像（DALL·E 3 / gpt-image-1）',
  description:
    '复用提示词优化用的 API Key 和 baseURL。支持 OpenAI 官方、Azure OpenAI、各类 OpenAI 兼容中转。',
  capabilities: {
    sizes: GPT_IMAGE_SIZES,
    maxBatch: 4,
    qualities: [
      { id: 'low', label: '低（便宜）' },
      { id: 'medium', label: '中' },
      { id: 'high', label: '高（更贵更慢）' }
    ],
    configFields: [
      {
        key: 'image_model',
        label: '默认图像模型',
        type: 'string',
        placeholder: 'gpt-image-1 或 dall-e-3',
        description: '可选 gpt-image-1（推荐）或 dall-e-3，也可填厂商自有图像模型 ID。'
      },
      {
        key: 'image_base_url',
        label: '自定义 baseURL（可空）',
        type: 'string',
        placeholder: 'https://api.openai.com/v1',
        description: '留空则用预设默认。Azure / 中转 / 自建服务可填这里。'
      }
    ]
  },
  defaultParams: {
    width: 1024,
    height: 1024,
    count: 1,
    quality: 'medium'
  },
  async generate(input: ImageGenerationInput): Promise<ImageGenerationOutcome> {
    return window.promptHub.image.openaiGenerate(input)
  }
}

// Re-export sizes so tests / callers that needed them keep working.
export { DALLE3_SIZES, GPT_IMAGE_SIZES }
