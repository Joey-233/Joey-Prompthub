import { useEffect, useMemo } from 'react'

import { LibrarySidebar } from '../components/library/LibrarySidebar'
import { LibraryToolbar } from '../components/library/LibraryToolbar'
import { PromptCard } from '../components/library/PromptCard'
import { PromptEditor } from '../components/library/PromptEditor'
import { QuickCapture } from '../components/library/QuickCapture'
import { WorkspaceLayout } from '../components/layout/WorkspaceLayout'
import { sortPrompts } from '../shared/promptActivity'
import { usePromptStore } from '../stores/promptStore'

export function Library() {
  const loading = usePromptStore((state) => state.loading)
  const prompts = usePromptStore((state) => state.prompts)
  const filterTag = usePromptStore((state) => state.filterTag)
  const sortMode = usePromptStore((state) => state.sortMode)
  const search = usePromptStore((state) => state.search)
  const selectedPromptId = usePromptStore((state) => state.selectedPromptId)
  const loadPrompts = usePromptStore((state) => state.loadPrompts)
  const selectPrompt = usePromptStore((state) => state.selectPrompt)
  const toggleFavorite = usePromptStore((state) => state.toggleFavorite)

  useEffect(() => {
    void loadPrompts()
  }, [loadPrompts])

  useEffect(() => {
    function onFocus() {
      void loadPrompts()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadPrompts])

  const normalizedSearch = search.trim().toLowerCase()

  const visiblePrompts = useMemo(
    () =>
      sortPrompts(
        prompts.filter((prompt) => {
          const matchesTag = filterTag === null || prompt.tags.includes(filterTag)
          const matchesSearch =
            normalizedSearch.length === 0 ||
            prompt.title.toLowerCase().includes(normalizedSearch) ||
            prompt.content.toLowerCase().includes(normalizedSearch) ||
            prompt.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch))
          return matchesTag && matchesSearch
        }),
        sortMode
      ),
    [prompts, filterTag, sortMode, normalizedSearch]
  )

  useEffect(() => {
    const hasSelectedVisiblePrompt = visiblePrompts.some(
      (prompt) => prompt.id === selectedPromptId
    )
    const nextSelectedPromptId = visiblePrompts[0]?.id ?? null

    if (!hasSelectedVisiblePrompt && selectedPromptId !== nextSelectedPromptId) {
      selectPrompt(nextSelectedPromptId)
    }
  }, [selectPrompt, selectedPromptId, visiblePrompts])

  const selectedPrompt =
    visiblePrompts.find((prompt) => prompt.id === selectedPromptId) ?? null

  const main = <main className="library-main" aria-label="提示词工作区">
      <QuickCapture />
      <LibraryToolbar />
      {loading ? (
        <div className="empty-state">正在加载提示词...</div>
      ) : (
          <div className="prompt-grid">
            {visiblePrompts.length === 0 ? (
              <div className="empty-state prompt-grid-empty">
                没有匹配的提示词
              </div>
            ) : (
              visiblePrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  selected={prompt.id === selectedPromptId}
                  onSelect={() => selectPrompt(prompt.id)}
                  onToggleFavorite={() => void toggleFavorite(prompt)}
                />
              ))
            )}
          </div>
      )}
    </main>
  const detail = selectedPrompt ? <PromptEditor prompt={selectedPrompt} /> : <div className="empty-state library-detail-empty">选择一条提示词即可查看和编辑详情</div>
  return <WorkspaceLayout resource={<LibrarySidebar />} resourceLabel="提示词筛选" main={main} detail={detail} detailLabel="提示词详情" />
}
