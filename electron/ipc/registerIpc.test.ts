import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => 'C:/tmp') },
  clipboard: { readText: vi.fn(() => '') },
  dialog: { showMessageBox: vi.fn() },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      if (handlers.has(channel)) throw new Error(`Duplicate IPC handler: ${channel}`)
      handlers.set(channel, handler)
    })
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(value)),
    decryptString: vi.fn((value: Buffer) => value.toString())
  },
  shell: { openExternal: vi.fn() }
}))

import type { PromptDatabase } from '../db'
import { registerIpc } from './registerIpc'

function database() {
  return {
    prompts: {
      list: vi.fn(() => []),
      listPage: vi.fn(() => ({ items: [], total: 0, hasMore: false })),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    generations: {
      list: vi.fn(() => []),
      listPage: vi.fn(() => ({ items: [], total: 0, hasMore: false })),
      create: vi.fn(),
      createBatch: vi.fn(),
      delete: vi.fn(),
      clearBefore: vi.fn()
    },
    settings: { list: vi.fn(() => ({})), set: vi.fn() },
    data: {
      exportBackup: vi.fn(),
      previewImport: vi.fn(),
      importBackup: vi.fn(),
      storageStats: vi.fn()
    },
    seedance2: {
      listTemplates: vi.fn(),
      createTemplate: vi.fn(),
      updateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      listPresets: vi.fn(),
      createPreset: vi.fn(),
      updatePreset: vi.fn(),
      deletePreset: vi.fn()
    }
  } as unknown as PromptDatabase
}

function event(senderId = 7, url = 'file:///C:/app/out/renderer/index.html') {
  return { sender: { id: senderId }, senderFrame: { url } }
}

beforeEach(() => {
  handlers.clear()
})

describe('IPC trust boundary', () => {
  function setup() {
    const db = database()
    const mainWindow = { isDestroyed: () => false, webContents: { id: 7 } }
    registerIpc({
      database: db,
      getMainWindow: () => mainWindow as never,
      getFloatingBall: () => null,
      openMainWindow: vi.fn(),
      setLaunchAtLogin: vi.fn(),
      setFloatingEnabled: vi.fn(),
      quitApp: vi.fn(),
      showFloatingContextMenu: vi.fn()
    })
    return db
  }

  it('rejects a sender that is not the registered main window', () => {
    setup()
    expect(() => handlers.get('prompts:list')?.(event(999), {})).toThrow('IPC 请求来源不受信任')
  })

  it('rejects a trusted window loaded from an untrusted page', () => {
    setup()
    expect(() =>
      handlers.get('prompts:list')?.(event(7, 'https://evil.example/index.html'), {})
    ).toThrow('IPC 页面来源不受信任')
  })

  it('validates payloads before invoking the database', () => {
    const db = setup()
    expect(() => handlers.get('prompts:create')?.(event(), { content: '' })).toThrow('提示词内容')
    expect(db.prompts.create).not.toHaveBeenCalled()
  })

  it('prevents the renderer from writing internal settings', () => {
    const db = setup()
    expect(() =>
      handlers.get('settings:set')?.(event(), {
        key: 'internal.approved_endpoints',
        value: ['ai:https://evil.example']
      })
    ).toThrow('不支持的设置')
    expect(db.settings.set).not.toHaveBeenCalled()
  })

  it('does not expose removed test-bench generation channels', () => {
    setup()
    expect([...handlers.keys()].some((channel) => channel.startsWith('generations:'))).toBe(false)
  })

  it('allows the renderer to set and clear the Seedance2 default template', () => {
    const db = setup()
    const handler = handlers.get('settings:set')

    handler?.(event(), {
      key: 'seedance2_default_template_id',
      value: 'template-42'
    })
    handler?.(event(), {
      key: 'seedance2_default_template_id',
      value: null
    })

    expect(db.settings.set).toHaveBeenNthCalledWith(
      1,
      'seedance2_default_template_id',
      'template-42'
    )
    expect(db.settings.set).toHaveBeenNthCalledWith(2, 'seedance2_default_template_id', null)
  })

  it('rejects an invalid Seedance2 default template id', () => {
    const db = setup()

    expect(() =>
      handlers.get('settings:set')?.(event(), {
        key: 'seedance2_default_template_id',
        value: '../not-an-id'
      })
    ).toThrow('ID 格式不正确')
    expect(db.settings.set).not.toHaveBeenCalled()
  })
})
