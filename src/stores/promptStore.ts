import { create } from 'zustand'

import type {
  CreatePromptInput,
  PromptRecord,
  UpdatePromptInput
} from '../shared/types'
import type { LibrarySortMode } from '../shared/promptActivity'

/** `null` = no tag filter (show everything). */
type TagFilter = string | null

interface PromptState {
  prompts: PromptRecord[]
  loading: boolean
  filterTag: TagFilter
  sortMode: LibrarySortMode
  search: string
  selectedPromptId: string | null
  loadPrompts: () => Promise<void>
  createPrompt: (input: CreatePromptInput) => Promise<void>
  updatePrompt: (id: string, patch: UpdatePromptInput) => Promise<void>
  deletePrompt: (id: string) => Promise<void>
  toggleFavorite: (prompt: PromptRecord) => Promise<void>
  setFilterTag: (filterTag: TagFilter) => void
  setSortMode: (sortMode: LibrarySortMode) => void
  setSearch: (search: string) => void
  selectPrompt: (id: string | null) => void
}

function isPromptRecord(value: unknown): value is PromptRecord {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'tags' in value &&
      'content' in value
  )
}

export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: [],
  loading: false,
  filterTag: null,
  sortMode: 'default',
  search: '',
  selectedPromptId: null,
  async loadPrompts() {
    set({ loading: true })
    try {
      const prompts = await window.promptHub.prompts.list()
      set((current) => ({
        prompts,
        loading: false,
        selectedPromptId:
          current.selectedPromptId &&
          prompts.some((prompt) => prompt.id === current.selectedPromptId)
            ? current.selectedPromptId
            : prompts[0]?.id ?? null
      }))
    } catch {
      set({ loading: false })
    }
  },
  async createPrompt(input) {
    await window.promptHub.prompts.create(input)
    await get().loadPrompts()
  },
  async updatePrompt(id, patch) {
    const updated = await window.promptHub.prompts.update(id, patch)

    if (!isPromptRecord(updated)) {
      await get().loadPrompts()
      return
    }

    set((current) => ({
      prompts: current.prompts.map((prompt) => (prompt.id === id ? updated : prompt))
    }))
  },
  async deletePrompt(id) {
    await window.promptHub.prompts.delete(id)
    set((current) => {
      const prompts = current.prompts.filter((prompt) => prompt.id !== id)
      return {
        prompts,
        selectedPromptId:
          current.selectedPromptId === id ? prompts[0]?.id ?? null : current.selectedPromptId
      }
    })
  },
  async toggleFavorite(prompt) {
    const updated = await window.promptHub.prompts.update(prompt.id, {
      isFavorite: !prompt.isFavorite
    })

    set((current) => ({
      prompts: current.prompts.map((item) =>
        item.id === updated.id ? updated : item
      )
    }))
  },
  setFilterTag(filterTag) {
    set({ filterTag })
  },
  setSortMode(sortMode) {
    set({ sortMode })
  },
  setSearch(search) {
    set({ search })
  },
  selectPrompt(id) {
    set({ selectedPromptId: id })
  }
}))
