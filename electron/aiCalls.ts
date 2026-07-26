/**
 * 所有第三方 HTTP 调用都在主进程发起，避开渲染进程的 CORS 限制。
 * 这里实现 OpenAI Chat Completions 兼容调用：
 *   - 文本消息用于 AI 优化
 *   - 多模态消息用于识图反推提示词
 *
 * API Key 直接在主进程从 secretStore 读取，不跨 IPC 暴露到渲染进程。
 */

import { findAiPreset } from '../src/services/ai/presets'
import type { AiDescribeImageInput, AiOptimizeBridgeInput } from '../src/shared/types'
import type { PromptDatabase } from './db'
import { secretStore } from './secretStore'
import { fetchJson, validateServiceBaseUrl } from './httpClient'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/* ===================== chat.completions 公共部分 ===================== */

interface ResolvedAiEndpoint {
  apiKey: string
  baseURL: string
  model: string
}

/**
 * 从 settings + secretStore 解析出文本 AI 的调用三元组。
 * 任何缺项都抛带预设名的中文错误，UI 直接展示。
 */
function resolveAiEndpoint(database: PromptDatabase, modelOverride?: string): ResolvedAiEndpoint {
  const settings = database.settings.list()
  const presetId = String(settings.ai_preset ?? 'doubao')
  const preset = findAiPreset(presetId)

  const baseURL = validateServiceBaseUrl(
    trimTrailingSlash(String(settings.ai_base_url ?? '').trim() || preset.baseURL)
  )
  const model =
    modelOverride ||
    String(settings.ai_model ?? '').trim() ||
    preset.defaultModel ||
    'doubao-seed-evolving'
  const apiKey = secretStore.reveal('ai.apiKey')

  if (!apiKey) throw new Error(`请先在设置页填写 ${preset.label} 的 API Key`)
  if (!baseURL) throw new Error('请在设置页填写自定义 baseURL，或选择内置预设')
  if (!model) throw new Error('请在设置页填写默认模型名')

  return { apiKey, baseURL, model }
}

type ChatMessageContent =
  string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: ChatMessageContent
}

async function postChatCompletions(
  endpoint: ResolvedAiEndpoint,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  const data = await fetchJson<{
    choices?: Array<{ message?: { content?: string } }>
  }>(
    `${endpoint.baseURL}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${endpoint.apiKey}`
      },
      body: JSON.stringify({ model: endpoint.model, messages })
    },
    { signal, serviceLabel: 'AI 服务' }
  )
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

/* ===================== AI 优化 ===================== */

function directionInstruction(input: AiOptimizeBridgeInput): string {
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
  input: AiOptimizeBridgeInput,
  signal?: AbortSignal
): Promise<string> {
  const endpoint = resolveAiEndpoint(database, input.model)

  return postChatCompletions(
    endpoint,
    [
      {
        role: 'system',
        content: '你是提示词优化助手。只返回优化后的最终提示词，不要加解释，不要加标题。'
      },
      {
        role: 'user',
        content: `优化方向：${directionInstruction(input)}\n\n原始提示词：\n${input.content}`
      }
    ],
    signal
  )
}

/* ===================== 识图（多模态） ===================== */

const DEFAULT_VISION_INSTRUCTION =
  '仔细观察这张图片，反推出一段可用于 AI 绘图、能复现画面主体、构图、风格、光线和质感的中文提示词。只返回提示词本身，不要任何解释。'

export async function callAiVision(
  database: PromptDatabase,
  input: AiDescribeImageInput,
  signal?: AbortSignal
): Promise<string> {
  if (!input.imageDataUrl?.startsWith('data:image/')) {
    throw new Error('图片数据格式不正确，请重新选择图片')
  }

  // 设置页只保留一套 OpenAI 兼容文字 API。识图复用相同的地址、模型和密钥；
  // 如果所选模型不支持 image_url，服务商会返回明确的模型能力错误。
  const endpoint = resolveAiEndpoint(database, input.model)
  const instruction = input.instruction?.trim() || DEFAULT_VISION_INSTRUCTION

  return postChatCompletions(
    endpoint,
    [
      {
        role: 'system',
        content: '你是图像理解与提示词反推助手。'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: instruction },
          { type: 'image_url', image_url: { url: input.imageDataUrl } }
        ]
      }
    ],
    signal
  )
}

export type ProviderConnectionKind = 'ai'

const modelCache = new Map<string, { expiresAt: number; models: string[] }>()

export async function checkProviderConnection(
  database: PromptDatabase,
  kind: ProviderConnectionKind,
  signal?: AbortSignal
) {
  const endpoint = resolveAiEndpoint(database)
  if (!endpoint.apiKey) throw new Error('请先填写 API Key')

  const cached = modelCache.get(endpoint.baseURL)
  if (cached && cached.expiresAt > Date.now()) {
    return { message: `连接成功，发现 ${cached.models.length} 个模型`, models: cached.models }
  }
  const payload = await fetchJson<{ data?: Array<{ id?: string }> }>(
    `${endpoint.baseURL}/models`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${endpoint.apiKey}` }
    },
    { signal, timeoutMs: 15_000, serviceLabel: '模型服务' }
  )
  const models = [
    ...new Set(
      (payload.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id))
    )
  ]
    .sort()
    .slice(0, 500)
  modelCache.set(endpoint.baseURL, { expiresAt: Date.now() + 5 * 60_000, models })
  return {
    message:
      models.length > 0
        ? `连接成功，发现 ${models.length} 个模型`
        : '连接成功，但服务未返回模型列表',
    models
  }
}
