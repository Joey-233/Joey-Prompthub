import type {
  ImageGenerationInput,
  ImageGenerationOutcome,
  ImageProvider
} from './types'

const SAMPLERS = [
  'DPM++ 2M Karras',
  'Euler a',
  'Euler',
  'DPM++ SDE Karras',
  'DDIM',
  'UniPC'
]

/**
 * 渲染层只保留 capabilities 元数据，HTTP 调用走主进程。
 * 这样用户的 SD WebUI 不需要额外加 --cors-allow-origins=* 也能用。
 */
export const sdWebuiProvider: ImageProvider = {
  id: 'sd-webui',
  label: 'Stable Diffusion WebUI（自建）',
  description: '指向本机或局域网内运行的 AUTOMATIC1111 / Forge WebUI 实例。',
  capabilities: {
    sizes: [
      { id: '512x512', label: '512×512', width: 512, height: 512 },
      { id: '768x512', label: '768×512', width: 768, height: 512 },
      { id: '512x768', label: '512×768', width: 512, height: 768 },
      { id: '1024x1024', label: '1024×1024 (SDXL)', width: 1024, height: 1024 },
      { id: '1024x1536', label: '1024×1536 (SDXL)', width: 1024, height: 1536 },
      { id: '1536x1024', label: '1536×1024 (SDXL)', width: 1536, height: 1024 }
    ],
    steps: { min: 1, max: 100, default: 28 },
    samplers: SAMPLERS,
    maxBatch: 8,
    configFields: [
      {
        key: 'image_base_url',
        label: 'SD WebUI 地址',
        type: 'string',
        placeholder: 'http://127.0.0.1:7860'
      }
    ]
  },
  defaultParams: {
    width: 512,
    height: 768,
    steps: 28,
    sampler: 'DPM++ 2M Karras',
    count: 1
  },
  async generate(input: ImageGenerationInput): Promise<ImageGenerationOutcome> {
    return window.promptHub.image.sdWebuiGenerate(input)
  }
}
