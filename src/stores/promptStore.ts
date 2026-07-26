import { create } from 'zustand'

import type { CreatePromptInput, PromptRecord, UpdatePromptInput } from '../shared/types'
import type { LibrarySortMode } from '../shared/promptActivity'

/** `null` = no tag filter (show everything). */
type TagFilter = string | null

interface PromptState {
  prompts: PromptRecord[]
  loading: boolean
  error: string | null
  total: number
  hasMore: boolean
  filterTag: TagFilter
  sortMode: LibrarySortMode
  search: string
  selectedPromptId: string | null
  selectedPrompt: PromptRecord | null
  loadingDetail: boolean
  drafts: Record<string, PromptDraft>
  loadPrompts: () => Promise<void>
  loadMore: () => Promise<void>
  createPrompt: (input: CreatePromptInput) => Promise<void>
  updatePrompt: (id: string, patch: UpdatePromptInput) => Promise<void>
  deletePrompt: (id: string) => Promise<void>
  toggleFavorite: (prompt: PromptRecord) => Promise<void>
  setFilterTag: (filterTag: TagFilter) => void
  setSortMode: (sortMode: LibrarySortMode) => void
  setSearch: (search: string) => void
  selectPrompt: (id: string | null) => void
  setDraft: (prompt: PromptRecord) => void
  saveDraft: (id: string) => Promise<void>
}

export interface PromptDraft {
  prompt: PromptRecord
  patch: UpdatePromptInput
  revision: number
  status: 'saving' | 'error'
}

function isPromptRecord(value: unknown): value is PromptRecord {
  return Boolean(
    value && typeof value === 'object' && 'id' in value && 'tags' in value && 'content' in value
  )
}

export const usePromptStore = create<PromptState>((set, get) => {
  const fieldVersions = new Map<string, Map<keyof UpdatePromptInput, number>>()
  let mutationEpoch = 0
  let loadSequence = 0
  let detailSequence = 0

  async function loadDetail(id: string | null) {
    const sequence = ++detailSequence
    if (!id) {
      set({ selectedPrompt: null, loadingDetail: false })
      return
    }
    set({ loadingDetail: true })
    try {
      const prompt = await window.promptHub.prompts.get(id)
      if (sequence === detailSequence && get().selectedPromptId === id) {
        set({ selectedPrompt: prompt, loadingDetail: false })
      }
    } catch {
      if (sequence === detailSequence) set({ selectedPrompt: null, loadingDetail: false })
    }
  }

  async function mutatePrompt(id: string, patch: UpdatePromptInput) {
    mutationEpoch += 1
    const promptVersions = fieldVersions.get(id) ?? new Map<keyof UpdatePromptInput, number>()
    fieldVersions.set(id, promptVersions)
    const requestVersions = new Map<keyof UpdatePromptInput, number>()
    for (const field of Object.keys(patch) as Array<keyof UpdatePromptInput>) {
      const version = (promptVersions.get(field) ?? 0) + 1
      promptVersions.set(field, version)
      requestVersions.set(field, version)
    }

    const updated = await window.promptHub.prompts.update(id, patch)
    const response = isPromptRecord(updated) ? updated : null
    set((current) => ({
      prompts: current.prompts.map((prompt) => {
        if (prompt.id !== id) return prompt
        const fields: UpdatePromptInput = {}
        for (const [field, version] of requestVersions) {
          if (promptVersions.get(field) !== version) continue
          const value =
            response && field in response ? response[field as keyof PromptRecord] : patch[field]
          Object.assign(fields, { [field]: value })
        }
        return { ...prompt, ...fields }
      }),
      selectedPrompt:
        current.selectedPrompt?.id === id && response ? response : current.selectedPrompt
    }))
  }

  return {
    prompts: [],
    loading: false,
    error: null,
    total: 0,
    hasMore: false,
    filterTag: null,
    sortMode: 'default',
    search: '',
    selectedPromptId: null,
    selectedPrompt: null,
    loadingDetail: false,
    drafts: {},
    async loadPrompts() {
      const sequence = ++loadSequence
      const loadEpoch = mutationEpoch
      set({ loading: true, error: null })
      try {
        const state = get()
        const page = await window.promptHub.prompts.listPage({
          search: state.search,
          tag: state.filterTag,
          sort: state.sortMode,
          limit: 100,
          offset: 0
        })
        const prompts = page.items
        if (sequence !== loadSequence) return
        if (loadEpoch !== mutationEpoch) {
          set({ loading: false })
          return
        }
        let nextSelected: string | null = null
        set((current) => {
          nextSelected =
            current.selectedPromptId &&
            prompts.some((prompt) => prompt.id === current.selectedPromptId)
              ? current.selectedPromptId
              : (prompts[0]?.id ?? null)
          return {
            prompts,
            loading: false,
            total: page.total,
            hasMore: page.hasMore,
            selectedPromptId: nextSelected
          }
        })
        void loadDetail(nextSelected)
      } catch (error) {
        if (sequence === loadSequence) {
          set({ loading: false, error: error instanceof Error ? error.message : '提示词加载失败' })
        }
      }
    },
    async loadMore() {
      const state = get()
      if (state.loading || !state.hasMore) return
      set({ loading: true, error: null })
      try {
        const page = await window.promptHub.prompts.listPage({
          search: state.search,
          tag: state.filterTag,
          sort: state.sortMode,
          limit: 100,
          offset: state.prompts.length
        })
        set((current) => ({
          prompts: [
            ...current.prompts,
            ...page.items.filter(
              (item) => !current.prompts.some((existing) => existing.id === item.id)
            )
          ],
          total: page.total,
          hasMore: page.hasMore,
          loading: false
        }))
      } catch (error) {
        set({
          loading: false,
          error: error instanceof Error ? error.message : '更多提示词加载失败'
        })
      }
    },
    async createPrompt(input) {
      mutationEpoch += 1
      await window.promptHub.prompts.create(input)
      await get().loadPrompts()
    },
    async updatePrompt(id, patch) {
      await mutatePrompt(id, patch)
    },
    async deletePrompt(id) {
      mutationEpoch += 1
      await window.promptHub.prompts.delete(id)
      set((current) => {
        const prompts = current.prompts.filter((prompt) => prompt.id !== id)
        return {
          prompts,
          selectedPrompt: current.selectedPromptId === id ? null : current.selectedPrompt,
          selectedPromptId:
            current.selectedPromptId === id ? (prompts[0]?.id ?? null) : current.selectedPromptId
        }
      })
    },
    async toggleFavorite(prompt) {
      await mutatePrompt(prompt.id, {
        isFavorite: !prompt.isFavorite
      })
    },
    setFilterTag(filterTag) {
      set({ filterTag, hasMore: false })
    },
    setSortMode(sortMode) {
      set({ sortMode, hasMore: false })
    },
    setSearch(search) {
      set({ search, hasMore: false })
    },
    selectPrompt(id) {
      set({ selectedPromptId: id })
      void loadDetail(id)
    },
    setDraft(prompt) {
      set((current) => {
        const previous = current.drafts[prompt.id]
        return {
          drafts: {
            ...current.drafts,
            [prompt.id]: {
              prompt,
              patch: {
                title: prompt.title,
                content: prompt.content,
                notes: prompt.notes,
                tags: prompt.tags,
                params: prompt.params,
                previewImages: prompt.previewImages?.length
                  ? prompt.previewImages
                  : prompt.previewImage
                    ? [prompt.previewImage]
                    : []
              },
              revision: (previous?.revision ?? 0) + 1,
              status: 'saving'
            }
          }
        }
      })
    },
    async saveDraft(id) {
      const snapshot = get().drafts[id]
      if (!snapshot) return
      set((current) =>
        current.drafts[id]?.revision === snapshot.revision
          ? {
              drafts: { ...current.drafts, [id]: { ...snapshot, status: 'saving' } }
            }
          : {}
      )
      try {
        await mutatePrompt(id, snapshot.patch)
        set((current) => {
          if (current.drafts[id]?.revision !== snapshot.revision) return {}
          const drafts = { ...current.drafts }
          delete drafts[id]
          return { drafts }
        })
      } catch (error) {
        set((current) =>
          current.drafts[id]?.revision === snapshot.revision
            ? {
                drafts: { ...current.drafts, [id]: { ...snapshot, status: 'error' } }
              }
            : {}
        )
        throw error
      }
    }
  }
})
