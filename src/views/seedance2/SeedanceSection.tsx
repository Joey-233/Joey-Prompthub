import type { ReactNode, Ref } from 'react'

interface Props {
  id: string
  title: string
  expanded: boolean
  sectionRef: Ref<HTMLElement>
  onToggle: () => void
  onTitleChange: (title: string) => void
  onTitleBlur: () => void
  onDelete: () => void
  onMoveEarlier: () => void
  onMoveLater: () => void
  canMoveEarlier: boolean
  canMoveLater: boolean
  children: ReactNode
}

export function SeedanceSection({
  id,
  title,
  expanded,
  sectionRef,
  onToggle,
  onTitleChange,
  onTitleBlur,
  onDelete,
  onMoveEarlier,
  onMoveLater,
  canMoveEarlier,
  canMoveLater,
  children
}: Props) {
  return (
    <section ref={sectionRef} className="s2-accordion">
      <div className="s2-section-header">
        <h2>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={`seedance-section-${id}`}
            onClick={onToggle}
          >
            {title || '未命名类目'}
          </button>
        </h2>
        <div className="s2-section-controls">
          <input
            className="s2-section-title-input"
            aria-label={`类目标题 ${title}`}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            onBlur={onTitleBlur}
          />
          <button
            type="button"
            aria-label={`上移类目 ${title}`}
            disabled={!canMoveEarlier}
            onClick={onMoveEarlier}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`下移类目 ${title}`}
            disabled={!canMoveLater}
            onClick={onMoveLater}
          >
            ↓
          </button>
          <button type="button" aria-label={`删除类目 ${title}`} onClick={onDelete}>
            删除
          </button>
        </div>
      </div>
      <div id={`seedance-section-${id}`} hidden={!expanded}>
        {children}
      </div>
    </section>
  )
}
