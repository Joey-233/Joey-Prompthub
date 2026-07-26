import { useEffect } from 'react'

import { LibrarySidebar } from '../components/library/LibrarySidebar'
import { LibraryToolbar } from '../components/library/LibraryToolbar'
import { PromptCard } from '../components/library/PromptCard'
import { PromptEditor } from '../components/library/PromptEditor'
import { QuickCapture } from '../components/library/QuickCapture'
import { WorkspaceLayout } from '../components/layout/WorkspaceLayout'
import { usePromptStore } from '../stores/promptStore'

export function Library() {
  const loading = usePromptStore((state) => state.loading)
  const error = usePromptStore((state) => state.error)
  const hasMore = usePromptStore((state) => state.hasMore)
  const prompts = usePromptStore((state) => state.prompts)
  const filterTag = usePromptStore((state) => state.filterTag)
  const sortMode = usePromptStore((state) => state.sortMode)
  const search = usePromptStore((state) => state.search)
  const selectedPromptId = usePromptStore((state) => state.selectedPromptId)
  const selectedPrompt = usePromptStore((state) => state.selectedPrompt)
  const loadingDetail = usePromptStore((state) => state.loadingDetail)
  const loadPrompts = usePromptStore((state) => state.loadPrompts)
  const loadMore = usePromptStore((state) => state.loadMore)
  const selectPrompt = usePromptStore((state) => state.selectPrompt)
  const toggleFavorite = usePromptStore((state) => state.toggleFavorite)

  useEffect(() => {
    void loadPrompts()
  }, [loadPrompts, filterTag, sortMode, search])

  useEffect(() => {
    function onFocus() {
      void loadPrompts()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadPrompts])

  const visiblePrompts = prompts

  useEffect(() => {
    const hasSelectedVisiblePrompt = visiblePrompts.some((prompt) => prompt.id === selectedPromptId)
    const nextSelectedPromptId = visiblePrompts[0]?.id ?? null

    if (!hasSelectedVisiblePrompt && selectedPromptId !== nextSelectedPromptId) {
      selectPrompt(nextSelectedPromptId)
    }
  }, [selectPrompt, selectedPromptId, visiblePrompts])

  const main = (
    <main className="library-main" aria-label="提示词工作区">
      <QuickCapture />
      <LibraryToolbar />
      {loading && prompts.length === 0 ? (
        <div className="empty-state">正在加载提示词...</div>
      ) : error && prompts.length === 0 ? (
        <div className="empty-state" role="alert">
          <p>{error}</p>
          <button className="editor-action" type="button" onClick={() => void loadPrompts()}>
            重试
          </button>
        </div>
      ) : (
        <div className="prompt-grid">
          {visiblePrompts.length === 0 ? (
            <div className="empty-state prompt-grid-empty">没有匹配的提示词</div>
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
          {error ? (
            <p className="field-hint field-hint-error" role="alert">
              {error}
            </p>
          ) : null}
          {hasMore && (
            <button
              className="editor-action library-load-more"
              disabled={loading}
              type="button"
              onClick={() => void loadMore()}
            >
              {loading ? '加载中…' : '加载更多'}
            </button>
          )}
        </div>
      )}
    </main>
  )
  const detail = (
    <div className="library-detail" data-compact="true">
      {loadingDetail ? (
        <div className="empty-state library-detail-empty">正在加载详情…</div>
      ) : selectedPrompt ? (
        <PromptEditor prompt={selectedPrompt} />
      ) : (
        <div className="empty-state library-detail-empty">选择一条提示词即可查看和编辑详情</div>
      )}
    </div>
  )
  return (
    <WorkspaceLayout
      className="library-workspace"
      resource={<LibrarySidebar />}
      resourceLabel="提示词筛选"
      main={main}
      detail={detail}
      detailLabel="提示词详情"
    />
  )
}
