import type { GenerationRecord, PromptRecord } from '../../shared/types'
import { formatRelativeTime } from '../../shared/formatTime'

export function HistoryPanel({
  history,
  prompts,
  scope,
  onScopeChange,
  onRestore
}: {
  history: GenerationRecord[]
  prompts: PromptRecord[]
  scope: 'current-prompt' | 'all'
  onScopeChange: (scope: 'current-prompt' | 'all') => void
  onRestore: (entryId: string) => void
}) {
  return (
    <section className="history-panel">
      <div className="history-toolbar">
        <div>
          <h3 className="bench-section-title">历史生成</h3>
          <p className="history-description">从上一轮结果里捞回一版，继续在当前工作区迭代。</p>
        </div>
        <div className="history-scope-group">
          <button
            className="filter-chip"
            data-active={scope === 'current-prompt'}
            type="button"
            onClick={() => onScopeChange('current-prompt')}
          >
            当前提示词
          </button>
          <button
            className="filter-chip"
            data-active={scope === 'all'}
            type="button"
            onClick={() => onScopeChange('all')}
          >
            全部历史
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="empty-state history-empty-state">还没有生成历史</div>
      ) : (
        <div className="history-grid">
          {history.map((entry) => {
            const hasSourcePrompt =
              !entry.promptId || prompts.some((prompt) => prompt.id === entry.promptId)

            return (
              <button
                key={entry.id}
                aria-label={`恢复历史：${entry.promptTitleSnapshot}`}
                className="history-card"
                type="button"
                onClick={() => onRestore(entry.id)}
              >
                <div className="history-card-header">
                  <strong>{entry.promptTitleSnapshot}</strong>
                  <span>{formatRelativeTime(entry.createdAt)}</span>
                </div>
                <p className="history-card-preview">{entry.promptSnapshot}</p>
                {!hasSourcePrompt ? (
                  <span className="history-card-note history-card-note-danger">
                    原提示词已删除
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
