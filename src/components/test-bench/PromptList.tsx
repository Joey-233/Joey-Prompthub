import { useMemo, useState } from 'react'
import type { PromptRecord } from '../../shared/types'

export function PromptList({
  prompts,
  selectedPromptId,
  onSelect
}: {
  prompts: PromptRecord[]
  selectedPromptId: string | null
  onSelect: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [recentOnly, setRecentOnly] = useState(false)
  const visiblePrompts = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matched = query ? prompts.filter((prompt) => `${prompt.title} ${prompt.content} ${prompt.tags.join(' ')}`.toLowerCase().includes(query)) : prompts
    if (!recentOnly) return matched
    return [...matched].filter((prompt) => prompt.lastUsedAt || prompt.id === selectedPromptId).sort((a, b) => {
      if (a.id === selectedPromptId) return -1
      if (b.id === selectedPromptId) return 1
      return (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') || b.useCount - a.useCount || b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [prompts, recentOnly, search, selectedPromptId])
  return (
    <aside className="bench-prompt-list">
      <h2 className="bench-section-title">选择提示词</h2>
      <input aria-label="搜索绘图提示词" className="bench-prompt-search" placeholder="搜索" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      <div className="bench-prompt-filters"><button type="button" aria-pressed={!recentOnly} onClick={() => setRecentOnly(false)}>全部</button><button type="button" aria-pressed={recentOnly} onClick={() => setRecentOnly(true)}>最近使用</button></div>
      {prompts.length === 0 ? (
        <div className="bench-empty-copy">暂无可直接保存回库的绘图提示词</div>
      ) : null}
      {visiblePrompts.map((prompt) => (
        <button
          key={prompt.id}
          className="bench-prompt-item"
          data-active={selectedPromptId === prompt.id}
          type="button"
          onClick={() => onSelect(prompt.id)}
        >
          <strong>{prompt.title}</strong>
        </button>
      ))}
      {prompts.length > 0 && visiblePrompts.length === 0 ? <div className="bench-empty-copy">没有匹配的提示词</div> : null}
    </aside>
  )
}
