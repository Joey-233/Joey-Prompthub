import { dialog, type BrowserWindow } from 'electron'

import { AI_PRESETS, findAiPreset } from '../src/services/ai/presets'
import type { PromptDatabase } from './db'
import { validateServiceBaseUrl } from './httpClient'

export type EndpointPurpose = 'ai'

const APPROVAL_KEY = 'internal.approved_endpoints'
const BUILTIN_BASE_URLS = new Set(
  AI_PRESETS.map((preset) => preset.baseURL)
    .filter(Boolean)
    .map((url) => validateServiceBaseUrl(url, { allowLoopbackHttp: true }))
)

export function resolveEndpointBaseUrl(database: PromptDatabase, _purpose: EndpointPurpose) {
  const settings = database.settings.list()
  const preset = findAiPreset(String(settings.ai_preset ?? 'doubao'))
  return String(settings.ai_base_url ?? '').trim() || preset.baseURL
}

function readApprovals(database: PromptDatabase): string[] {
  const value = database.settings.list()[APPROVAL_KEY]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export async function ensureEndpointApproved(
  database: PromptDatabase,
  purpose: EndpointPurpose,
  parent: BrowserWindow | null
) {
  const raw = resolveEndpointBaseUrl(database, purpose)
  const baseURL = validateServiceBaseUrl(raw)
  if (BUILTIN_BASE_URLS.has(baseURL)) return baseURL

  const approval = `${purpose}:${new URL(baseURL).origin}`
  if (readApprovals(database).includes(approval)) return baseURL
  if (!parent || parent.isDestroyed()) throw new Error('无法确认自定义服务地址，请打开主窗口后重试')

  const result = await dialog.showMessageBox(parent, {
    type: 'warning',
    title: '确认自定义 AI 服务',
    message: '是否允许向此自定义服务发送内容？',
    detail: `${new URL(baseURL).origin}\n\n提示词、图片和对应 API Key 可能发送到该服务。仅在你信任该地址时允许。`,
    buttons: ['取消', '允许此地址'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  })
  if (result.response !== 1) throw new Error('已取消向自定义服务发送数据')
  database.settings.set(APPROVAL_KEY, [...new Set([...readApprovals(database), approval])])
  return baseURL
}
