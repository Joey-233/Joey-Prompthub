import { create } from 'zustand'

import { IMAGE_TAG, type GenerationRecord, type PromptRecord } from '../shared/types'
import { buildUsagePatch } from '../shared/promptActivity'
import {
  generateWithProvider,
  getImageProviderOrFallback
} from '../services/image/providerRegistry'
import type {
  ImageGenerationItem,
  ImageGenerationParams
} from '../services/image/types'

interface TestBenchState {
  prompts: PromptRecord[]
  selectedPromptId: string | null
  draftContent: string
  providerId: string
  params: ImageGenerationParams
  results: GenerationRecord[]
  history: GenerationRecord[]
  loading: boolean
  loadingPrompts: boolean
  loadingHistory: boolean
  historyScope: 'current-prompt' | 'all'
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  generateError: string | null
  loadPrompts: (preferredPromptId?: string | null) => Promise<void>
  loadHistory: () => Promise<void>
  selectPrompt: (id: string) => void
  setDraftContent: (value: string) => void
  setProviderId: (id: string) => void
  setParams: (patch: Partial<ImageGenerationParams>) => void
  setHistoryScope: (scope: 'current-prompt' | 'all') => void
  restoreHistoryEntry: (entryId: string) => void
  saveDraft: () => Promise<void>
  generate: () => Promise<void>
}

function deriveInitialProvider(settings: Record<string, unknown>): string {
  const fromSettings = settings.image_preset
  if (typeof fromSettings === 'string' && fromSettings) return fromSettings
  return 'openai-image'
}

export const useTestBenchStore = create<TestBenchState>((set, get) => ({
  prompts: [],
  selectedPromptId: null,
  draftContent: '',
  providerId: 'openai-image',
  params: { ...getImageProviderOrFallback('openai-image').defaultParams },
  results: [],
  history: [],
  loading: false,
  loadingPrompts: false,
  loadingHistory: false,
  historyScope: 'current-prompt',
  saveStatus: 'idle',
  generateError: null,
  async loadPrompts(preferredPromptId) {
    set({ loadingPrompts: true })
    try {
      const [allPrompts, settings] = await Promise.all([
        window.promptHub.prompts.list(),
        window.promptHub.settings.list()
      ])
      const prompts = allPrompts.filter((prompt) => prompt.tags.includes(IMAGE_TAG))
      const preferredPrompt =
        prompts.find((prompt) => prompt.id === preferredPromptId) ??
        prompts.find((prompt) => prompt.id === get().selectedPromptId) ??
        prompts[0] ??
        null

      const providerId = deriveInitialProvider(settings)
      const provider = getImageProviderOrFallback(providerId)

      set({
        prompts,
        selectedPromptId: preferredPrompt?.id ?? null,
        draftContent: preferredPrompt?.content ?? '',
        providerId: provider.id,
        params: { ...provider.defaultParams },
        results: [],
        saveStatus: 'idle',
        generateError: null,
        loadingPrompts: false
      })
    } catch {
      set({ loadingPrompts: false })
    }
  },
  async loadHistory() {
    set({ loadingHistory: true })
    try {
      const history = await window.promptHub.generations.list()
      set({ history, loadingHistory: false })
    } catch {
      set({ loadingHistory: false })
    }
  },
  selectPrompt(id) {
    const prompt = get().prompts.find((item) => item.id === id)
    if (!prompt) {
      return
    }

    set({
      selectedPromptId: id,
      draftContent: prompt.content,
      results: [],
      saveStatus: 'idle',
      generateError: null
    })
  },
  setDraftContent(value) {
    set({ draftContent: value, saveStatus: 'idle' })
  },
  setProviderId(id) {
    const provider = getImageProviderOrFallback(id)
    set({
      providerId: provider.id,
      params: { ...provider.defaultParams },
      generateError: null
    })
  },
  setParams(patch) {
    set((current) => ({ params: { ...current.params, ...patch } }))
  },
  setHistoryScope(scope) {
    set({ historyScope: scope })
  },
  restoreHistoryEntry(entryId) {
    const entry = get().history.find((item) => item.id === entryId)
    if (!entry) {
      return
    }

    const sourcePrompt =
      get().prompts.find((prompt) => prompt.id === entry.promptId) ?? null

    set({
      selectedPromptId: sourcePrompt?.id ?? null,
      draftContent: entry.promptSnapshot,
      results: [],
      saveStatus: 'idle',
      generateError: null
    })
  },
  async saveDraft() {
    const state = get()

    if (!state.selectedPromptId) {
      return
    }

    set({ saveStatus: 'saving' })

    try {
      const currentPrompt =
        state.prompts.find((prompt) => prompt.id === state.selectedPromptId) ?? null
      const timestamp = new Date().toISOString()
      const updated = await window.promptHub.prompts.update(state.selectedPromptId, {
        content: state.draftContent,
        ...(currentPrompt ? buildUsagePatch(currentPrompt, timestamp) : {})
      })

      set((current) => ({
        prompts: current.prompts.map((prompt) =>
          prompt.id === updated.id ? updated : prompt
        ),
        saveStatus: 'saved'
      }))
    } catch {
      set({ saveStatus: 'error' })
    }
  },
  async generate() {
    const state = get()
    if (state.loading || !state.draftContent.trim()) {
      return
    }

    const selectedPrompt = state.prompts.find(
      (prompt) => prompt.id === state.selectedPromptId
    )
    const timestamp = new Date().toISOString()

    set({ loading: true, generateError: null })

    try {
      const outcome = await generateWithProvider(state.providerId, {
        prompt: state.draftContent,
        params: state.params
      })

      const persisted: GenerationRecord[] = []
      const records: ImageGenerationItem[] = outcome.results
      const titleSnapshot = selectedPrompt?.title ?? '未命名提示词'

      for (const result of records) {
        const createdAt = new Date().toISOString()
        const persistedRecord = await window.promptHub.generations.create({
          promptId: state.selectedPromptId,
          providerId: outcome.providerId,
          status: outcome.status,
          promptTitleSnapshot: titleSnapshot,
          promptSnapshot: state.draftContent,
          imageData: result.imageData,
          params: outcome.effectiveParams
        })
        persisted.push(
          persistedRecord ?? {
            id: crypto.randomUUID(),
            promptId: state.selectedPromptId,
            providerId: outcome.providerId,
            status: outcome.status,
            promptTitleSnapshot: titleSnapshot,
            promptSnapshot: state.draftContent,
            imageData: result.imageData,
            params: outcome.effectiveParams,
            createdAt
          }
        )
      }

      if (selectedPrompt && outcome.status !== 'failed') {
        const updatedPrompt = await window.promptHub.prompts.update(selectedPrompt.id, {
          ...buildUsagePatch(selectedPrompt, timestamp),
          lastGeneratedAt: timestamp
        })

        set((current) => ({
          prompts: current.prompts.map((prompt) =>
            prompt.id === updatedPrompt.id ? updatedPrompt : prompt
          )
        }))
      }

      await get().loadHistory()

      set({
        results: persisted,
        generateError: outcome.status === 'failed' ? '生成失败：服务没有返回任何图片' : null
      })
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : '生成失败，请稍后重试'
      set({ generateError: message })
    } finally {
      set({ loading: false })
    }
  }
}))
