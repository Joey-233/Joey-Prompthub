import { clipboard, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'

import { IMAGE_TAG } from '../../src/shared/types'
import {
  callAiOptimize,
  callAiVision,
  checkProviderConnection,
  type ProviderConnectionKind
} from '../aiCalls'
import type { PromptDatabase } from '../db'
import type { FloatingBallController } from '../floatingBall'
import { secretStore } from '../secretStore'
import { isTrustedRendererUrl } from '../windowSecurity'
import { ensureEndpointApproved } from '../endpointPolicy'
import {
  asBoolean,
  asId,
  asRecord,
  asString,
  validateCreatePrompt,
  validateBackup,
  validatePromptFilter,
  validateSecretKey,
  validateSecretPayload,
  validateSeedancePreset,
  validateSeedanceTemplate,
  validateSetting,
  validateUpdatePrompt
} from './validation'

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown

export interface RegisterIpcOptions {
  database: PromptDatabase
  getMainWindow: () => BrowserWindow | null
  getFloatingBall: () => FloatingBallController | null
  openMainWindow: () => void
  setLaunchAtLogin: (enabled: boolean) => void
  setFloatingEnabled: (enabled: boolean) => void
  quitApp: () => void
  showFloatingContextMenu: () => void
}

function assertSender(
  event: IpcMainInvokeEvent,
  expectedWindow: BrowserWindow | null,
  entry: 'index.html' | 'floating-ball.html'
) {
  if (
    !expectedWindow ||
    expectedWindow.isDestroyed() ||
    event.sender.id !== expectedWindow.webContents.id
  ) {
    throw new Error('IPC 请求来源不受信任')
  }
  if (!isTrustedRendererUrl(event.senderFrame?.url ?? '', entry)) {
    throw new Error('IPC 页面来源不受信任')
  }
}

function readAiOptimizeInput(value: unknown) {
  const input = asRecord(value, 'AI 优化参数')
  return {
    content: asString(input.content, '提示词内容', { min: 1, max: 100_000 }),
    direction: asString(input.direction, '优化方向', { min: 1, max: 80 }),
    customInstruction:
      input.customInstruction === undefined
        ? undefined
        : asString(input.customInstruction, '自定义指令', { max: 5_000 }),
    model: input.model === undefined ? undefined : asString(input.model, '模型', { max: 200 })
  }
}

function readVisionInput(value: unknown) {
  const input = asRecord(value, '识图参数')
  const imageDataUrl = asString(input.imageDataUrl, '图片', {
    min: 1,
    max: 12 * 1024 * 1024,
    trim: false
  })
  if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(imageDataUrl)) {
    throw new Error('图片仅支持 PNG、JPEG 或 WebP')
  }
  return {
    imageDataUrl,
    instruction:
      input.instruction === undefined
        ? undefined
        : asString(input.instruction, '识图指令', { max: 5_000 }),
    model: input.model === undefined ? undefined : asString(input.model, '模型', { max: 200 })
  }
}

export function registerIpc(options: RegisterIpcOptions) {
  const {
    database,
    getMainWindow,
    getFloatingBall,
    openMainWindow,
    setLaunchAtLogin,
    setFloatingEnabled,
    quitApp,
    showFloatingContextMenu
  } = options
  const operations = new Map<string, AbortController>()

  const withOperation = async <T>(raw: unknown, operation: (signal: AbortSignal) => Promise<T>) => {
    const record = asRecord(raw, '请求参数')
    const requestId =
      record.requestId === undefined
        ? crypto.randomUUID()
        : asString(record.requestId, '请求 ID', { min: 1, max: 128 })
    if (operations.has(requestId)) throw new Error('请求 ID 正在使用')
    const controller = new AbortController()
    operations.set(requestId, controller)
    try {
      return await operation(controller.signal)
    } finally {
      operations.delete(requestId)
    }
  }

  const handleMain = (channel: string, handler: Handler) => {
    ipcMain.handle(channel, (event, ...args) => {
      assertSender(event, getMainWindow(), 'index.html')
      return handler(event, ...args)
    })
  }
  const handleFloating = (channel: string, handler: Handler) => {
    ipcMain.handle(channel, (event, ...args) => {
      assertSender(event, getFloatingBall()?.window ?? null, 'floating-ball.html')
      return handler(event, ...args)
    })
  }

  handleMain('prompts:list', (_event, filter) =>
    database.prompts.list(validatePromptFilter(filter))
  )
  handleMain('prompts:listPage', (_event, filter) =>
    database.prompts.listPage(validatePromptFilter(filter))
  )
  handleMain('prompts:get', (_event, id) => database.prompts.get(asId(id)))
  handleMain('prompts:create', (_event, input) =>
    database.prompts.create(validateCreatePrompt(input))
  )
  handleMain('prompts:update', (_event, payload) => {
    const { id, patch } = validateUpdatePrompt(payload)
    return database.prompts.update(id, patch)
  })
  handleMain('prompts:delete', (_event, id) => database.prompts.delete(asId(id)))

  handleMain('settings:list', () => database.settings.list())
  handleMain('settings:set', (_event, payload) => {
    const record = asRecord(payload, '设置参数')
    const validated = validateSetting(record.key, record.value)
    database.settings.set(validated.key, validated.value)
  })

  handleMain('data:exportBackup', () => database.data.exportBackup())
  handleMain('data:previewImport', (_event, value) =>
    database.data.previewImport(validateBackup(value))
  )
  handleMain('data:importBackup', (_event, value) => {
    const record = asRecord(value, '导入参数')
    const mode = asString(record.mode, '导入模式', { min: 1, max: 20 })
    if (!['merge', 'replace'].includes(mode)) throw new Error('导入模式不正确')
    return database.data.importBackup(validateBackup(record.backup), mode as 'merge' | 'replace')
  })
  handleMain('data:storageStats', () => database.data.storageStats())

  handleMain('secure:has', (_event, key) => secretStore.has(validateSecretKey(key)))
  handleMain('secure:set', (_event, payload) => {
    const validated = validateSecretPayload(payload)
    secretStore.set(validated.key, validated.value)
  })
  handleMain('secure:delete', (_event, key) => secretStore.delete(validateSecretKey(key)))

  handleMain('seedance2:listTemplates', () => database.seedance2.listTemplates())
  handleMain('seedance2:createTemplate', (_event, input) =>
    database.seedance2.createTemplate(validateSeedanceTemplate(input))
  )
  handleMain('seedance2:updateTemplate', (_event, payload) => {
    const record = asRecord(payload, '模板更新')
    return database.seedance2.updateTemplate(
      asId(record.id),
      validateSeedanceTemplate(record.patch)
    )
  })
  handleMain('seedance2:deleteTemplate', (_event, id) =>
    database.seedance2.deleteTemplate(asId(id))
  )
  handleMain('seedance2:listPresets', () => database.seedance2.listPresets())
  handleMain('seedance2:createPreset', (_event, input) =>
    database.seedance2.createPreset(validateSeedancePreset(input))
  )
  handleMain('seedance2:updatePreset', (_event, payload) => {
    const record = asRecord(payload, '预设更新')
    return database.seedance2.updatePreset(asId(record.id), validateSeedancePreset(record.patch))
  })
  handleMain('seedance2:deletePreset', (_event, id) => database.seedance2.deletePreset(asId(id)))

  handleMain('ai:optimize', async (_event, input) => {
    await ensureEndpointApproved(database, 'ai', getMainWindow())
    return withOperation(input, (signal) =>
      callAiOptimize(database, readAiOptimizeInput(input), signal)
    )
  })
  handleMain('ai:describeImage', async (_event, input) => {
    await ensureEndpointApproved(database, 'ai', getMainWindow())
    return withOperation(input, (signal) => callAiVision(database, readVisionInput(input), signal))
  })
  handleMain('ai:checkConnection', async (_event, value) => {
    const kind = asString(value, '服务类型', { min: 1, max: 20 })
    if (kind !== 'ai') throw new Error('服务类型不正确')
    await ensureEndpointApproved(database, 'ai', getMainWindow())
    return checkProviderConnection(database, kind as ProviderConnectionKind)
  })
  handleMain('ai:cancelRequest', (_event, value) => {
    const requestId = asString(value, '请求 ID', { min: 1, max: 128 })
    operations.get(requestId)?.abort()
  })

  handleMain('system:clipboardImport', () => {
    const text = clipboard.readText().trim()
    if (!text) return null
    return database.prompts.create({ content: text.slice(0, 100_000), tags: [IMAGE_TAG] })
  })
  handleMain('system:openMainWindow', () => openMainWindow())
  handleMain('system:setLaunchAtLogin', (_event, enabled) =>
    setLaunchAtLogin(asBoolean(enabled, '开机自启'))
  )
  handleMain('system:setFloatingEnabled', (_event, enabled) =>
    setFloatingEnabled(asBoolean(enabled, '悬浮球开关'))
  )
  handleMain('system:quitApp', () => quitApp())

  handleFloating('floating:openMainWindow', () => openMainWindow())
  handleFloating('system:getFloatingState', () => getFloatingBall()?.getState())
  handleFloating('system:showFloatingContextMenu', () => showFloatingContextMenu())
  handleFloating('floating:dragStart', (_event, input) => {
    const record = input === undefined ? {} : asRecord(input, '拖动参数')
    const coordinate = (value: unknown) => {
      if (value === undefined) return undefined
      if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 100_000) {
        throw new Error('拖动坐标不正确')
      }
      return value
    }
    return getFloatingBall()?.startDrag({
      cursorScreenX: coordinate(record.cursorScreenX),
      cursorScreenY: coordinate(record.cursorScreenY)
    })
  })
  handleFloating('floating:dragEnd', (_event, payload) => {
    const record = payload === undefined ? {} : asRecord(payload, '拖动结束参数')
    return getFloatingBall()?.endDrag(
      record.snap === undefined ? false : asBoolean(record.snap, '吸附状态')
    )
  })
}
