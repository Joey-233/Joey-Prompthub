import { useEffect, useState } from 'react'

import type { LibrarySortMode } from '../../shared/promptActivity'
import { usePromptStore } from '../../stores/promptStore'

const SORTS: Array<{ id: LibrarySortMode; label: string }> = [
  { id: 'default', label: '默认' },
  { id: 'recent-used', label: '最近使用' },
  { id: 'favorites', label: '已收藏' },
  { id: 'recent-generated', label: '最近生成' }
]

export function LibraryToolbar() {
  const search = usePromptStore((state) => state.search)
  const sortMode = usePromptStore((state) => state.sortMode)
  const setSearch = usePromptStore((state) => state.setSearch)
  const setSortMode = usePromptStore((state) => state.setSortMode)
  const [value, setValue] = useState(search)
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(value), 200)
    return () => window.clearTimeout(timer)
  }, [value, setSearch])
  return (
    <div className="library-toolbar">
      <input
        aria-label="搜索提示词"
        className="search-input"
        placeholder="搜索标题、内容或标签..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <select
        aria-label="排序方式"
        className="library-sort-select"
        value={sortMode}
        onChange={(event) => setSortMode(event.target.value as LibrarySortMode)}
      >
        {SORTS.map((sort) => (
          <option key={sort.id} value={sort.id}>
            {sort.label}
          </option>
        ))}
      </select>
    </div>
  )
}
