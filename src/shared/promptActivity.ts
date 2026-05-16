import type { PromptRecord, UpdatePromptInput } from './types'

export type LibrarySortMode =
  | 'default'
  | 'recent-used'
  | 'favorites'
  | 'recent-generated'

export function buildUsagePatch(
  prompt: Pick<PromptRecord, 'useCount'>,
  timestamp: string
): UpdatePromptInput {
  return {
    lastUsedAt: timestamp,
    useCount: prompt.useCount + 1
  }
}

function timestampValue(value: string | null) {
  if (!value) {
    return 0
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function sortPrompts(prompts: PromptRecord[], sortMode: LibrarySortMode) {
  const items = [...prompts]

  if (sortMode === 'favorites') {
    return items
      .filter((prompt) => prompt.isFavorite)
      .sort((left, right) => timestampValue(right.lastUsedAt) - timestampValue(left.lastUsedAt))
  }

  if (sortMode === 'recent-used') {
    return items.sort(
      (left, right) => timestampValue(right.lastUsedAt) - timestampValue(left.lastUsedAt)
    )
  }

  if (sortMode === 'recent-generated') {
    return items.sort(
      (left, right) =>
        timestampValue(right.lastGeneratedAt) - timestampValue(left.lastGeneratedAt)
    )
  }

  return items.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
}
