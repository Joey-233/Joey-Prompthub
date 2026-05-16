import { useEffect, useMemo, useState } from 'react'

import { IMAGE_TAG, LLM_TAG, TYPE_TAGS } from '../../shared/types'
import { usePromptStore } from '../../stores/promptStore'

const SORT_LABELS: Array<{ id: 'default' | 'recent-used' | 'favorites' | 'recent-generated'; label: string }> = [
  { id: 'default', label: '默认' },
  { id: 'recent-used', label: '最近使用' },
  { id: 'favorites', label: '已收藏' },
  { id: 'recent-generated', label: '最近生成' }
]

const TYPE_TAG_PRIORITY: Record<string, number> = {
  [IMAGE_TAG]: 0,
  [LLM_TAG]: 1
}

export function LibraryFilters() {
  const filterTag = usePromptStore((state) => state.filterTag)
  const sortMode = usePromptStore((state) => state.sortMode)
  const prompts = usePromptStore((state) => state.prompts)
  const setFilterTag = usePromptStore((state) => state.setFilterTag)
  const setSortMode = usePromptStore((state) => state.setSortMode)
  const setSearch = usePromptStore((state) => state.setSearch)

  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setSearch(inputValue), 200)
    return () => clearTimeout(timer)
  }, [inputValue, setSearch])

  // Tag bar: type tags pinned at the front, then user tags by usage count.
  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const prompt of prompts) {
      for (const tag of prompt.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    // Always show 绘图/LLM even when no prompt carries them yet.
    for (const reserved of TYPE_TAGS) {
      if (!counts.has(reserved)) counts.set(reserved, 0)
    }
    return Array.from(counts.entries()).sort((a, b) => {
      const [tagA, countA] = a
      const [tagB, countB] = b
      const priorityA = TYPE_TAG_PRIORITY[tagA] ?? Infinity
      const priorityB = TYPE_TAG_PRIORITY[tagB] ?? Infinity
      if (priorityA !== priorityB) return priorityA - priorityB
      if (countA !== countB) return countB - countA
      return tagA.localeCompare(tagB)
    })
  }, [prompts])

  return (
    <div className="library-toolbar">
      <div className="library-toolbar-row">
        <input
          aria-label="搜索提示词"
          className="search-input"
          placeholder="搜索标题或内容..."
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
        />
        <div className="filter-group">
          {SORT_LABELS.map((option) => (
            <button
              key={option.id}
              className="filter-chip"
              data-active={sortMode === option.id}
              type="button"
              onClick={() => setSortMode(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="library-tag-bar" role="tablist" aria-label="标签筛选">
        <button
          className="library-tag-chip"
          data-active={filterTag === null}
          role="tab"
          aria-selected={filterTag === null}
          type="button"
          onClick={() => setFilterTag(null)}
        >
          全部
        </button>
        {tagOptions.map(([tag]) => {
          const isType = TYPE_TAGS.includes(tag as (typeof TYPE_TAGS)[number])
          return (
            <button
              key={tag}
              className="library-tag-chip"
              data-active={filterTag === tag}
              data-type-tag={isType}
              role="tab"
              aria-selected={filterTag === tag}
              type="button"
              onClick={() => setFilterTag(filterTag === tag ? null : tag)}
            >
              {tag}
            </button>
          )
        })}
      </div>
    </div>
  )
}
