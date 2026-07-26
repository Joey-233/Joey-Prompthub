import { useEffect, useRef, useState } from 'react'

import type { PromptRecord } from '../../shared/types'
import { TYPE_TAGS } from '../../shared/types'
import { formatRelativeTime } from '../../shared/formatTime'

const ROTATION_INTERVAL_MS = 1500

function getPreviewImages(prompt: PromptRecord): string[] {
  if (prompt.previewImages && prompt.previewImages.length > 0) return prompt.previewImages
  if (prompt.previewImage) return [prompt.previewImage]
  return []
}

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
  const displayTitle = prompt.title.trim() || '未命名提示词'
  const images = getPreviewImages(prompt)
  const [hovering, setHovering] = useState(false)
  const [idx, setIdx] = useState(0)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!hovering || images.length < 2) {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    timerRef.current = window.setInterval(() => {
      setIdx((i) => (i + 1) % images.length)
    }, ROTATION_INTERVAL_MS)
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [hovering, images.length])

  const currentImage = images[idx] ?? images[0]

  return (
    <article
      aria-label={displayTitle}
      className="prompt-card"
      data-selected={selected}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false)
        setIdx(0)
      }}
    >
      <button
        aria-label={prompt.isFavorite ? '取消收藏提示词' : '收藏提示词'}
        className="favorite-button"
        data-active={prompt.isFavorite}
        type="button"
        onClick={onToggleFavorite}
      >
        {prompt.isFavorite ? '★' : '☆'}
      </button>
      <button
        aria-label={displayTitle}
        className="prompt-card-select"
        type="button"
        onClick={onSelect}
      >
        <span className="prompt-card-title">{displayTitle}</span>
        {currentImage ? (
          <div className="prompt-card-preview-wrap">
            <img
              alt={`${displayTitle} 预览图`}
              className="prompt-card-preview"
              src={currentImage}
            />
            {images.length > 1 && (
              <div className="prompt-card-preview-dots" aria-hidden>
                {images.map((_, i) => (
                  <span key={i} className="prompt-card-preview-dot" data-active={i === idx} />
                ))}
              </div>
            )}
          </div>
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
      </button>
    </article>
  )
}
