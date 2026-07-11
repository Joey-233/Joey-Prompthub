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

export const usePromptStore = create<PromptState>((set, get) => {
  const fieldVersions = new Map<string, Map<keyof UpdatePromptInput, number>>()
  let mutationEpoch = 0

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
          const value = response && field in response ? response[field as keyof PromptRecord] : patch[field]
          Object.assign(fields, { [field]: value })
        }
        return { ...prompt, ...fields }
      })
    }))
  }

  return ({
  prompts: [],
  loading: false,
  filterTag: null,
  sortMode: 'default',
  search: '',
  selectedPromptId: null,
  async loadPrompts() {
    const loadEpoch = mutationEpoch
    set({ loading: true })
    try {
      const prompts = await window.promptHub.prompts.list()
      if (loadEpoch !== mutationEpoch) {
        set({ loading: false })
        return
      }
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
        selectedPromptId:
          current.selectedPromptId === id ? prompts[0]?.id ?? null : current.selectedPromptId
      }
    })
  },
  async toggleFavorite(prompt) {
    await mutatePrompt(prompt.id, {
      isFavorite: !prompt.isFavorite
    })
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
  })
})
