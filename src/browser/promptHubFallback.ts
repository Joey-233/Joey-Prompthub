import type {
  GenerationRecord,
  PromptRecord,
  PromptHubApi,
  PromptHubBackupV1,
  Seedance2PresetRecord,
  Seedance2TemplateRecord
} from '../shared/types'

const STORAGE_KEY = 'prompthub.browser-fallback'

type BrowserStore = {
  prompts: PromptRecord[]
  generations: GenerationRecord[]
  settings: Record<string, unknown>
  templates: Seedance2TemplateRecord[]
  presets: Seedance2PresetRecord[]
}

let memoryStore: BrowserStore | null = null
let browserFallback: PromptHubApi | null = null

function createDefaultStore(): BrowserStore {
  return {
    prompts: [],
    generations: [],
    settings: {
      ai_preset: 'doubao',
      ai_base_url: 'https://ark.cn-beijing.volces.com/api/v3',
      ai_model: 'doubao-seed-evolving',
      theme_mode: 'system',
      launch_at_login: false,
      floating_enabled: true
    },
    templates: [],
    presets: []
  }
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function readStore(): BrowserStore {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    memoryStore ??= createDefaultStore()
    return cloneValue(memoryStore)
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return createDefaultStore()
  }

  try {
    return {
      ...createDefaultStore(),
      ...JSON.parse(raw)
    } as BrowserStore
  } catch {
    return createDefaultStore()
  }
}

function writeStore(store: BrowserStore) {
  memoryStore = cloneValue(store)

  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function createTitle(content: string) {
  return content.trim().slice(0, 20) || '未命名提示词'
}

function normalizePrompt(prompt: PromptRecord): PromptRecord {
  // Localstorage entries from previous app versions may lack newer fields.
  const images = (prompt.previewImages ?? (prompt.previewImage ? [prompt.previewImage] : []))
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .slice(0, 3)
  return {
    ...prompt,
    notes: prompt.notes ?? '',
    previewImage: images[0] ?? '',
    previewImages: images
  }
}

function sortPromptsByUpdatedAt(prompts: PromptRecord[]) {
  return [...prompts].map(normalizePrompt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function createPromptHubFallback(): PromptHubApi {
  const api: PromptHubApi = {
    prompts: {
      async list(filter) {
        const store = readStore()
        const search = filter?.search?.trim().toLowerCase()

        return sortPromptsByUpdatedAt(
          store.prompts.filter((prompt) => {
            if (!search) {
              return true
            }

            return (
              prompt.title.toLowerCase().includes(search) ||
              prompt.content.toLowerCase().includes(search)
            )
          })
        )
      },
      async listPage(filter) {
        const all = await api.prompts.list(filter)
        const offset = Math.max(0, filter?.offset ?? 0)
        const limit = Math.max(1, Math.min(filter?.limit ?? 100, 200))
        const items = all.slice(offset, offset + limit)
        return { items, total: all.length, hasMore: offset + items.length < all.length }
      },
      async get(id) {
        return cloneValue(readStore().prompts.find((prompt) => prompt.id === id) ?? null)
      },
      async create(input) {
        const store = readStore()
        const timestamp = new Date().toISOString()
        const created: PromptRecord = {
          id: crypto.randomUUID(),
          title: input.title?.trim() || createTitle(input.content),
          content: input.content.trim(),
          notes: input.notes ?? '',
          tags: [...(input.tags ?? [])],
          params: cloneValue(input.params ?? {}),
          previewImage: input.previewImages?.[0] ?? input.previewImage ?? '',
          previewImages: (input.previewImages ?? (input.previewImage ? [input.previewImage] : []))
            .filter((s): s is string => typeof s === 'string' && s.length > 0)
            .slice(0, 3),
          isFavorite: input.isFavorite ?? false,
          lastUsedAt: input.lastUsedAt ?? null,
          lastGeneratedAt: input.lastGeneratedAt ?? null,
          useCount: input.useCount ?? 0,
          createdAt: timestamp,
          updatedAt: timestamp
        }

        store.prompts.unshift(created)
        writeStore(store)
        return cloneValue(created)
      },
      async update(id, patch) {
        const store = readStore()
        const current = store.prompts.find((prompt) => prompt.id === id)

        if (!current) {
          throw new Error(`Prompt not found: ${id}`)
        }

        let nextImages: string[]
        if (patch.previewImages !== undefined) {
          nextImages = patch.previewImages
            .filter((s): s is string => typeof s === 'string' && s.length > 0)
            .slice(0, 3)
        } else if (patch.previewImage !== undefined) {
          nextImages = patch.previewImage ? [patch.previewImage] : []
        } else {
          nextImages = current.previewImages ?? (current.previewImage ? [current.previewImage] : [])
        }

        const updated: PromptRecord = {
          ...current,
          ...cloneValue(patch),
          title: patch.title?.trim() || current.title,
          tags: patch.tags ? [...patch.tags] : current.tags,
          params: patch.params ? cloneValue(patch.params) : current.params,
          previewImage: nextImages[0] ?? '',
          previewImages: nextImages,
          updatedAt: new Date().toISOString()
        }

        store.prompts = store.prompts.map((prompt) => (prompt.id === id ? updated : prompt))
        writeStore(store)
        return cloneValue(updated)
      },
      async delete(id) {
        const store = readStore()
        store.prompts = store.prompts.filter((prompt) => prompt.id !== id)
        writeStore(store)
      }
    },
    settings: {
      async list() {
        return cloneValue(readStore().settings)
      },
      async set(key, value) {
        const store = readStore()
        store.settings[key] = cloneValue(value)
        writeStore(store)
      }
    },
    data: {
      async exportBackup() {
        const store = readStore()
        return {
          format: 'prompthub-backup',
          version: 1,
          exportedAt: new Date().toISOString(),
          prompts: cloneValue(store.prompts),
          generations: cloneValue(store.generations),
          settings: cloneValue(store.settings),
          seedance2: {
            templates: cloneValue(store.templates),
            presets: cloneValue(store.presets)
          },
          excludes: ['apiKeys']
        } satisfies PromptHubBackupV1
      },
      async previewImport(value) {
        const backup = value as PromptHubBackupV1
        if (backup?.format !== 'prompthub-backup' || backup.version !== 1) {
          throw new Error('备份格式不受支持')
        }
        const store = readStore()
        const ids = new Set([
          ...store.prompts.map((item) => item.id),
          ...store.generations.map((item) => item.id),
          ...store.templates.map((item) => item.id),
          ...store.presets.map((item) => item.id)
        ])
        return {
          prompts: backup.prompts.length,
          generations: backup.generations.length,
          templates: backup.seedance2.templates.length,
          presets: backup.seedance2.presets.length,
          conflicts: [
            ...backup.prompts,
            ...backup.generations,
            ...backup.seedance2.templates,
            ...backup.seedance2.presets
          ].filter((item) => ids.has(item.id)).length
        }
      },
      async importBackup(value, mode) {
        const backup = value as PromptHubBackupV1
        const preview = await api.data.previewImport(backup)
        const store = mode === 'replace' ? createDefaultStore() : readStore()
        const merge = <T extends { id: string }>(existing: T[], incoming: T[]) => {
          const ids = new Set(existing.map((item) => item.id))
          return [...existing, ...incoming.filter((item) => !ids.has(item.id))]
        }
        store.prompts = merge(store.prompts, backup.prompts)
        store.generations = merge(store.generations, backup.generations)
        store.templates = merge(store.templates, backup.seedance2.templates)
        store.presets = merge(store.presets, backup.seedance2.presets)
        store.settings = { ...store.settings, ...backup.settings }
        writeStore(store)
        return preview
      },
      async storageStats() {
        const serialized = JSON.stringify(readStore())
        const databaseBytes = new TextEncoder().encode(serialized).byteLength
        return { databaseBytes, assetsBytes: 0, assetCount: 0, totalBytes: databaseBytes }
      }
    },
    secure: {
      async has() {
        return false
      },
      async set() {
        throw new Error('浏览器演示模式不保存 API Key，请使用桌面应用')
      },
      async delete() {
        throw new Error('浏览器演示模式没有可清除的 API Key')
      }
    },
    // The browser fallback only exists for the static prototype (no Electron
    // main process around), so real third-party HTTP calls aren't possible —
    // the renderer would hit CORS on most providers. Surface a clear error
    // instead of pretending it works.
    ai: {
      async optimize() {
        throw new Error('当前为浏览器演示模式，AI 优化需要在桌面应用内使用')
      },
      async describeImage() {
        throw new Error('当前为浏览器演示模式，识图需要在桌面应用内使用')
      },
      async checkConnection() {
        throw new Error('当前为浏览器演示模式，服务检测需要在桌面应用内使用')
      },
      async cancelRequest() {
        // 演示模式没有真实网络请求。
      }
    },
    seedance2: {
      async listTemplates() {
        return cloneValue(readStore().templates)
      },
      async createTemplate(input) {
        const store = readStore()
        const now = new Date().toISOString()
        const template = {
          id: crypto.randomUUID(),
          title: input.title,
          data: input.data,
          createdAt: now,
          updatedAt: now
        }
        store.templates.unshift(template)
        writeStore(store)
        return cloneValue(template)
      },
      async updateTemplate(id, patch) {
        const store = readStore()
        const current = store.templates.find((item) => item.id === id)
        if (!current) throw new Error('模板不存在')
        const now = new Date().toISOString()
        const template = { ...current, title: patch.title, data: patch.data, updatedAt: now }
        store.templates = store.templates.map((item) => (item.id === id ? template : item))
        writeStore(store)
        return cloneValue(template)
      },
      async deleteTemplate(id) {
        const store = readStore()
        store.templates = store.templates.filter((item) => item.id !== id)
        writeStore(store)
      },
      async listPresets() {
        return cloneValue(readStore().presets)
      },
      async createPreset(input) {
        const store = readStore()
        const now = new Date().toISOString()
        const preset = {
          id: crypto.randomUUID(),
          name: input.name,
          tags: input.tags ?? [],
          segment: input.segment,
          createdAt: now,
          updatedAt: now
        }
        store.presets.unshift(preset)
        writeStore(store)
        return cloneValue(preset)
      },
      async updatePreset(id, patch) {
        const store = readStore()
        const current = store.presets.find((item) => item.id === id)
        if (!current) throw new Error('预设不存在')
        const now = new Date().toISOString()
        const preset = {
          ...current,
          name: patch.name,
          tags: patch.tags ?? [],
          segment: patch.segment,
          updatedAt: now
        }
        store.presets = store.presets.map((item) => (item.id === id ? preset : item))
        writeStore(store)
        return cloneValue(preset)
      },
      async deletePreset(id) {
        const store = readStore()
        store.presets = store.presets.filter((item) => item.id !== id)
        writeStore(store)
      }
    },
    system: {
      async clipboardImport() {
        return null
      },
      async openMainWindow() {},
      async setLaunchAtLogin(enabled) {
        const store = readStore()
        store.settings.launch_at_login = enabled
        writeStore(store)
      },
      async setFloatingEnabled(enabled) {
        const store = readStore()
        store.settings.floating_enabled = enabled
        writeStore(store)
      },
      async quitApp() {}
    }
  }

  return api
}

export function ensurePromptHubBridge(options: { allowDemo?: boolean } = {}) {
  const currentWindow = window as Window & { promptHub?: PromptHubApi }

  if (currentWindow.promptHub) {
    return currentWindow.promptHub
  }

  const allowDemo =
    options.allowDemo === true ||
    import.meta.env.MODE === 'test' ||
    import.meta.env.VITE_PROMPTHUB_BROWSER_DEMO === '1'

  if (!allowDemo) {
    throw new Error('Joey Prompthub 安全桥接加载失败，请重启桌面应用')
  }

  browserFallback ??= createPromptHubFallback()
  document.documentElement.dataset.promptHubMode = 'demo'

  Object.defineProperty(window, 'promptHub', {
    configurable: true,
    value: browserFallback
  })

  return browserFallback
}
