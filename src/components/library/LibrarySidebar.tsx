import { useMemo } from 'react'

import { TYPE_TAGS } from '../../shared/types'
import { usePromptStore } from '../../stores/promptStore'

export function LibrarySidebar() {
  const prompts = usePromptStore((state) => state.prompts)
  const filterTag = usePromptStore((state) => state.filterTag)
  const sortMode = usePromptStore((state) => state.sortMode)
  const setFilterTag = usePromptStore((state) => state.setFilterTag)
  const setSortMode = usePromptStore((state) => state.setSortMode)
  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    prompts.forEach((prompt) =>
      prompt.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1))
    )
    TYPE_TAGS.forEach((tag) => counts.set(tag, counts.get(tag) ?? 0))
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [prompts])

  const tagButton = (tag: string | null, label = tag ?? '全部提示词') => (
    <button
      aria-label={label}
      className="library-nav-item"
      data-active={filterTag === tag}
      role="tab"
      aria-selected={filterTag === tag}
      type="button"
      onClick={() => setFilterTag(tag)}
    >
      <span>{label}</span>
      {tag && (
        <span className="library-nav-count">{tags.find(([value]) => value === tag)?.[1] ?? 0}</span>
      )}
    </button>
  )

  return (
    <nav className="library-sidebar" aria-label="提示词导航">
      <div className="library-sidebar-section" role="tablist" aria-label="类型和标签筛选">
        {tagButton(null)}
        {TYPE_TAGS.map((tag) => (
          <span key={tag}>{tagButton(tag)}</span>
        ))}
      </div>
      <div className="library-sidebar-section" aria-label="快捷视图">
        <button
          aria-pressed={sortMode === 'favorites'}
          className="library-nav-item"
          data-active={sortMode === 'favorites'}
          type="button"
          onClick={() => setSortMode('favorites')}
        >
          已收藏
        </button>
        <button
          aria-pressed={sortMode === 'recent-used'}
          className="library-nav-item"
          data-active={sortMode === 'recent-used'}
          type="button"
          onClick={() => setSortMode('recent-used')}
        >
          最近使用
        </button>
        <button
          aria-pressed={sortMode === 'recent-generated'}
          className="library-nav-item"
          data-active={sortMode === 'recent-generated'}
          type="button"
          onClick={() => setSortMode('recent-generated')}
        >
          最近生成
        </button>
      </div>
      <div
        className="library-sidebar-section library-sidebar-tags"
        role="tablist"
        aria-label="标签筛选"
      >
        {tags
          .filter(([tag]) => !TYPE_TAGS.includes(tag as (typeof TYPE_TAGS)[number]))
          .map(([tag]) => (
            <span key={tag}>{tagButton(tag)}</span>
          ))}
      </div>
    </nav>
  )
}
