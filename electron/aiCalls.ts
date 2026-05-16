/**
 * 所有第三方 HTTP 调用都在主进程发起，避开渲染进程的 CORS 限制。
 * 这里实现三类调用：
 *   - chat.completions 兼容（用于 AI 优化）
 *   - OpenAI 兼容图像生成
 *   - Stable Diffusion WebUI txt2img
 *
 * API Key 直接在主进程从 secretStore 读取，不再跨 IPC 暴露到渲染进程。
 */

import { findAiPreset, findImagePreset } from '../src/services/ai/presets'
import type {
  ImageGenerationInput,
  ImageGenerationOutcome
} from '../src/services/image/types'
import type { PromptDatabase } from './db'
import { secretStore } from './secretStore'

export interface AiOptimizeInput {
  content: string
  direction: string
  customInstruction?: string
  model?: string
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function directionInstruction(input: AiOptimizeInput): string {
  if (input.direction === '自定义指令') {
    return input.customInstruction?.trim() || '请优化这个提示词的表达质量。'
  }
  if (input.direction === '精简表达') {
    return '请保留原始意图，去掉冗余表达，让提示词更清晰、更简洁。'
  }
  return '请保留原始意图，增强画面细节、风格描述和执行稳定性。'
}

export async function callAiOptimize(
  database: PromptDatabase,
  input: AiOptimizeInput
): Promise<string> {
  const settings = database.settings.list()
  const presetId = String(settings.ai_preset ?? 'openai')
  const preset = findAiPreset(presetId)

  const baseURL = trimTrailingSlash(
    String(settings.ai_base_url ?? '').trim() || preset.baseURL
  )
  const model =
    input.model ||
    String(settings.ai_model ?? '').trim() ||
    preset.defaultModel ||
    'gpt-4.1-mini'
  const apiKey = secretStore.reveal('ai.apiKey')

  if (!apiKey) throw new Error(`请先在设置页填写 ${preset.label} 的 API Key`)
  if (!baseURL) throw new Error('请在设置页填写自定义 baseURL，或选择内置预设')
  if (!model) throw new Error('请在设置页填写默认模型名')

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            '你是提示词优化助手。只返回优化后的最终提示词，不要加解释，不要加标题。'
        },
        {
          role: 'user',
          content: `优化方向：${directionInstruction(input)}\n\n原始提示词：\n${input.content}`
        }
      ]
    })
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`AI 调用失败 (${response.status}): ${text.slice(0, 240)}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

const DALLE3_SIZES = [
  { width: 1024, height: 1024 },
  { width: 1792, height: 1024 },
  { width: 1024, height: 1792 }
] as const

const GPT_IMAGE_SIZES = [
  { width: 1024, height: 1024 },
  { width: 1536, height: 1024 },
  { width: 1024, height: 1536 }
] as const

export async function callOpenaiImage(
  database: PromptDatabase,
  input: ImageGenerationInput
): Promise<ImageGenerationOutcome> {
  const settings = database.settings.list()
  const presetId = String(settings.image_preset ?? 'openai-image')
  const preset = findImagePreset(presetId)

  const baseURL = trimTrailingSlash(
    String(settings.image_base_url ?? '').trim() ||
      preset.baseURL ||
      'https://api.openai.com/v1'
  )
  const model = String(settings.image_model ?? preset.defaultModel ?? 'gpt-image-1')
  const apiKey = secretStore.reveal('ai.apiKey')

  if (!apiKey) {
    throw new Error('请先在设置页填写 OpenAI 兼容图像服务的 API Key')
  }

  const isDalle3 = model === 'dall-e-3'
  const sizes = isDalle3 ? DALLE3_SIZES : GPT_IMAGE_SIZES
  const matchedSize =
    sizes.find(
      (option) =>
        option.width === input.params.width && option.height === input.params.height
    ) ?? sizes[0]
  const size = `${matchedSize.width}x${matchedSize.height}`
  const requestedCount = Math.max(1, Math.min(input.params.count ?? 1, 4))
  // DALL·E 3 一次只能出一张图，靠循环凑数。
  const callCount = isDalle3 ? requestedCount : 1
  const perCall = isDalle3 ? 1 : requestedCount

  const quality = isDalle3
    ? input.params.quality === 'high'
      ? 'hd'
      : 'standard'
    : ((input.params.quality as string | undefined) ?? 'medium')

  const results: ImageGenerationOutcome['results'] = []

  for (let i = 0; i < callCount; i += 1) {
    const body: Record<string, unknown> = {
      model,
      prompt: input.prompt,
      size,
      n: perCall,
      quality
    }
    if (isDalle3) {
      body.response_format = 'b64_json'
    }

    const response = await fetch(`${baseURL}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`图像服务调用失败 (${response.status}): ${text.slice(0, 240)}`)
    }

    const payload = (await response.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>
    }

    for (const datum of payload.data ?? []) {
      if (datum.b64_json) {
        results.push({
          imageData: `data:image/png;base64,${datum.b64_json}`,
          mimeType: 'image/png'
        })
        continue
      }
      if (datum.url) {
        results.push({ imageData: datum.url, mimeType: 'image/png' })
      }
    }
  }

  return {
    providerId: 'openai-image',
    status: results.length > 0 ? 'success' : 'failed',
    effectiveParams: {
      model,
      baseURL,
      size,
      quality,
      count: results.length
    },
    results
  }
}

export async function callSdWebui(
  database: PromptDatabase,
  input: ImageGenerationInput
): Promise<ImageGenerationOutcome> {
  const settings = database.settings.list()
  const raw = (settings.image_base_url as string) ?? ''
  const baseURL = trimTrailingSlash(raw.trim())

  if (!baseURL) {
    throw new Error('请先在设置页填写 SD WebUI 服务地址（如 http://127.0.0.1:7860）')
  }

  const body = {
    prompt: input.prompt,
    width: input.params.width,
    height: input.params.height,
    steps: input.params.steps ?? 28,
    sampler_name: input.params.sampler ?? 'DPM++ 2M Karras',
    batch_size: Math.max(1, Math.min(input.params.count ?? 1, 8))
  }

  const response = await fetch(`${baseURL}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`SD WebUI 调用失败 (${response.status}): ${text.slice(0, 240)}`)
  }

  const payload = (await response.json()) as { images?: string[] }
  const images = payload.images ?? []

  return {
    providerId: 'sd-webui',
    status: images.length > 0 ? 'success' : 'failed',
    effectiveParams: {
      width: body.width,
      height: body.height,
      steps: body.steps,
      sampler: body.sampler_name,
      batchSize: body.batch_size
    },
    results: images.map((b64) => ({
      imageData: b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`,
      mimeType: 'image/png'
    }))
  }
}
