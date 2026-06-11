import { IMAGE_TAG } from '../shared/types'
import type {
  CreatePromptInput,
  FloatingWindowState,
  GenerationRecord,
  MoveFloatingWindowInput,
  PromptRecord,
  PromptHubApi
} from '../shared/types'

const STORAGE_KEY = 'prompthub.browser-fallback'

type BrowserStore = {
  prompts: PromptRecord[]
  generations: GenerationRecord[]
  settings: Record<string, unknown>
  secure: Record<string, string>
  floating: FloatingWindowState
}

let memoryStore: BrowserStore | null = null
let browserFallback: PromptHubApi | null = null

function createDefaultStore(): BrowserStore {
  return {
    prompts: [],
    generations: [],
    settings: {
      ai_preset: 'openai',
      ai_model: 'gpt-4.1-mini',
      image_preset: 'mock-image',
      theme_mode: 'system',
      launch_at_login: false
    },
    secure: {},
    floating: {
      x: 0,
      y: 0,
      side: 'right',
      expanded: false
    }
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
  return { ...prompt, notes: prompt.notes ?? '', previewImage: prompt.previewImage ?? '' }
}

function sortPromptsByUpdatedAt(prompts: PromptRecord[]) {
  return [...prompts]
    .map(normalizePrompt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function sortGenerationsByCreatedAt(generations: GenerationRecord[]) {
  return [...generations].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function computeFloatingState(input: MoveFloatingWindowInput, previous: FloatingWindowState) {
  const viewportWidth =
    typeof window === 'undefined' ? 1440 : window.screen.availWidth || window.innerWidth || 1440
  const leftEdge = 16
  const rightEdge = Math.max(leftEdge, viewportWidth - 88)
  const side = input.x < viewportWidth / 2 ? 'left' : 'right'

  return {
    x: input.snap ? (side === 'left' ? leftEdge : rightEdge) : input.x,
    y: Math.max(16, input.y),
    side,
    expanded: false
  } satisfies FloatingWindowState
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
          previewImage: input.previewImage ?? '',
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

        const updated: PromptRecord = {
          ...current,
          ...cloneValue(patch),
          title: patch.title?.trim() || current.title,
          tags: patch.tags ? [...patch.tags] : current.tags,
          params: patch.params ? cloneValue(patch.params) : current.params,
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
    generations: {
      async list() {
        return sortGenerationsByCreatedAt(readStore().generations)
      },
      async create(input) {
        const store = readStore()
        const created: GenerationRecord = {
          id: crypto.randomUUID(),
          promptId: input.promptId ?? null,
          providerId: input.providerId,
          status: input.status,
          promptTitleSnapshot: input.promptTitleSnapshot,
          promptSnapshot: input.promptSnapshot,
          imageData: input.imageData,
          params: cloneValue(input.params ?? {}),
          createdAt: new Date().toISOString()
        }

        store.generations.unshift(created)
        writeStore(store)
        return cloneValue(created)
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
    secure: {
      async has(key) {
        return Boolean(readStore().secure[key])
      },
      async set(key, value) {
        const store = readStore()
        store.secure[key] = value
        writeStore(store)
      },
      async delete(key) {
        const store = readStore()
        delete store.secure[key]
        writeStore(store)
      },
      async reveal(key) {
        return readStore().secure[key] ?? null
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
      }
    },
    image: {
      async openaiGenerate() {
        throw new Error('当前为浏览器演示模式，请改用「Mock」provider 体验流程')
      },
      async sdWebuiGenerate() {
        throw new Error('当前为浏览器演示模式，请改用「Mock」provider 体验流程')
      }
    },
    system: {
      async clipboardImport() {
        try {
          const text = (await navigator.clipboard.readText()).trim()

          if (!text) {
            return null
          }

          return api.prompts.create({
            content: text,
            tags: [IMAGE_TAG]
          } satisfies CreatePromptInput)
        } catch {
          return null
        }
      },
      async openMainWindow() {},
      async setLaunchAtLogin(enabled) {
        const store = readStore()
        store.settings.launch_at_login = enabled
        writeStore(store)
      },
      async quitApp() {},
      async getFloatingState() {
        return cloneValue(readStore().floating)
      },
      async setFloatingExpanded() {
        const store = readStore()
        store.floating.expanded = false
        writeStore(store)
        return cloneValue(store.floating)
      },
      async moveFloatingWindow(input) {
        const store = readStore()
        store.floating = computeFloatingState(input, store.floating)
        writeStore(store)
        return cloneValue(store.floating)
      },
      async floatingDragStart() {
        return cloneValue(readStore().floating)
      },
      async floatingDragEnd() {
        return cloneValue(readStore().floating)
      },
      async showFloatingContextMenu() {}
    }
  }

  return api
}

export function ensurePromptHubBridge() {
  const currentWindow = window as Window & { promptHub?: PromptHubApi }

  if (currentWindow.promptHub) {
    return currentWindow.promptHub
  }

  browserFallback ??= createPromptHubFallback()

  Object.defineProperty(window, 'promptHub', {
    configurable: true,
    value: browserFallback
  })

  return browserFallback
}
