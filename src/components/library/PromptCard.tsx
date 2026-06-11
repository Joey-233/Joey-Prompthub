import type { PromptRecord } from '../../shared/types'
import { TYPE_TAGS } from '../../shared/types'
import { formatRelativeTime } from '../../shared/formatTime'

export function PromptCard({
  prompt,
  selected,
  onSelect,
  onToggleFavorite
}: {
  prompt: PromptRecord
  selected: boolean
  onSelect: () => void
  onToggleFavorite: () => void
}) {
  const lastActivity = prompt.lastGeneratedAt ?? prompt.lastUsedAt ?? null

  return (
    <article
      aria-label={prompt.title}
      className="prompt-card"
      data-selected={selected}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <button
        aria-label={prompt.isFavorite ? '取消收藏提示词' : '收藏提示词'}
        className="favorite-button"
        data-active={prompt.isFavorite}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggleFavorite()
        }}
      >
        {prompt.isFavorite ? '★' : '☆'}
      </button>
      {prompt.previewImage ? (
        <img
          alt={`${prompt.title} 预览图`}
          className="prompt-card-preview"
          src={prompt.previewImage}
        />
      ) : null}
      <p className="prompt-card-content">{prompt.content}</p>
      <div className="prompt-card-footer">
        {prompt.tags.length > 0 && (
          <div className="tag-row">
            {prompt.tags.map((tag) => (
              <span
                key={tag}
                className="tag-pill"
                data-type-tag={TYPE_TAGS.includes(tag as (typeof TYPE_TAGS)[number])}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="prompt-card-meta">
          {prompt.useCount > 0 && <span>使用 {prompt.useCount} 次</span>}
          <span>{formatRelativeTime(lastActivity)}</span>
        </div>
      </div>
    </article>
  )
}
