import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { Seedance2Segment } from '../../shared/types'

interface Props {
  segment: Seedance2Segment
  index: number
  onActivate: () => void
  onChange: (patch: Partial<Seedance2Segment>) => void
  onDelete: () => void
  onDuplicate: () => void
  onSaveAsPreset: () => void
}

export function SortableSegment({
  segment,
  index,
  onActivate,
  onChange,
  onDelete,
  onDuplicate,
  onSaveAsPreset
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: segment.id
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  }

  return (
    <div ref={setNodeRef} className="s2-segment" style={style} onFocusCapture={onActivate}>
      <div className="s2-segment-header">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="s2-segment-handle"
          aria-label="拖拽排序"
        >
          ⋮⋮
        </button>
        <span className="s2-segment-index">镜头 {index + 1}</span>
        <input
          className="s2-input time"
          value={segment.timeLabel}
          onChange={(e) => onChange({ timeLabel: e.target.value })}
          placeholder="0-3s"
        />
        <input
          className="s2-input"
          value={segment.shotType}
          onChange={(e) => onChange({ shotType: e.target.value })}
          placeholder="镜头类型，如 第一视角"
        />
        <button
          type="button"
          className="s2-btn s2-btn-icon"
          onClick={onSaveAsPreset}
          title="存为片段预设"
        >
          💾
        </button>
        <button type="button" className="s2-btn s2-btn-icon" onClick={onDuplicate} title="复制片段">
          📋
        </button>
        <button type="button" className="s2-btn s2-btn-icon" onClick={onDelete} title="删除片段">
          🗑
        </button>
      </div>
      <textarea
        className="s2-textarea"
        value={segment.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="主体描述，允许内嵌 🖐图片1 这类引用"
        rows={4}
      />
      <textarea
        data-shot-dialog-id={segment.id}
        className="s2-textarea"
        value={segment.dialog}
        onChange={(e) => onChange({ dialog: e.target.value })}
        placeholder='台词（每行一句，如 地精王："Pathetic."）'
        rows={2}
      />
    </div>
  )
}
