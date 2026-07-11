import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useEffect, useMemo, useState } from 'react'

import type {
  Seedance2PresetRecord,
  Seedance2RefGroup,
  Seedance2RefItem,
  Seedance2Segment,
  Seedance2TemplateData,
  Seedance2TemplateRecord
} from '../shared/types'

import { SortableSegment } from './seedance2/SortableSegment'
import { emptySegment, emptyTemplate, serializeTemplate } from './seedance2/serialize'

const api = () => window.promptHub.seedance2

export function Seedance2() {
  const [templates, setTemplates] = useState<Seedance2TemplateRecord[]>([])
  const [presets, setPresets] = useState<Seedance2PresetRecord[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Seedance2TemplateData>(emptyTemplate())
  const [title, setTitle] = useState('未命名模板')
  const [dirty, setDirty] = useState(false)
  const [showPresets, setShowPresets] = useState(true)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const reloadTemplates = async () => {
    const list = await api().listTemplates()
    setTemplates(list)
    return list
  }

  const reloadPresets = async () => {
    setPresets(await api().listPresets())
  }

  useEffect(() => {
    void reloadTemplates()
    void reloadPresets()
  }, [])

  const loadTemplate = (rec: Seedance2TemplateRecord) => {
    setCurrentId(rec.id)
    setTitle(rec.title)
    setDraft(rec.data)
    setDirty(false)
  }

  const handleNew = () => {
    setCurrentId(null)
    setTitle('未命名模板')
    setDraft(emptyTemplate())
    setDirty(true)
  }

  const handleSave = async () => {
    if (currentId) {
      const rec = await api().updateTemplate(currentId, { title, data: draft })
      await reloadTemplates()
      setCurrentId(rec.id)
    } else {
      const rec = await api().createTemplate({ title, data: draft })
      await reloadTemplates()
      setCurrentId(rec.id)
    }
    setDirty(false)
  }

  const handleDelete = async () => {
    if (!currentId) return
    if (!confirm(`删除模板「${title}」？`)) return
    await api().deleteTemplate(currentId)
    await reloadTemplates()
    handleNew()
  }

  const patchDraft = (patch: Partial<Seedance2TemplateData>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  const updateSegment = (id: string, patch: Partial<Seedance2Segment>) => {
    patchDraft({
      segments: draft.segments.map((s) => (s.id === id ? { ...s, ...patch } : s))
    })
  }

  const addSegment = () => {
    patchDraft({ segments: [...draft.segments, emptySegment()] })
  }

  const deleteSegment = (id: string) => {
    patchDraft({ segments: draft.segments.filter((s) => s.id !== id) })
  }

  const duplicateSegment = (id: string) => {
    const idx = draft.segments.findIndex((s) => s.id === id)
    if (idx < 0) return
    const copy = { ...draft.segments[idx], id: crypto.randomUUID() }
    const next = [...draft.segments]
    next.splice(idx + 1, 0, copy)
    patchDraft({ segments: next })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = draft.segments.findIndex((s) => s.id === active.id)
    const newIdx = draft.segments.findIndex((s) => s.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    patchDraft({ segments: arrayMove(draft.segments, oldIdx, newIdx) })
  }

  const saveSegmentAsPreset = async (seg: Seedance2Segment) => {
    const name = prompt('预设名称', seg.timeLabel || seg.shotType || '镜头预设')
    if (!name) return
    await api().createPreset({ name, segment: { ...seg, id: crypto.randomUUID() }, tags: [] })
    await reloadPresets()
  }

  const insertPreset = (preset: Seedance2PresetRecord) => {
    patchDraft({
      segments: [...draft.segments, { ...preset.segment, id: crypto.randomUUID() }]
    })
  }

  const deletePreset = async (id: string) => {
    if (!confirm('删除该片段预设？')) return
    await api().deletePreset(id)
    await reloadPresets()
  }

  const updateRefGroup = (idx: number, patch: Partial<Seedance2RefGroup>) => {
    patchDraft({
      refGroups: draft.refGroups.map((g, i) => (i === idx ? { ...g, ...patch } : g))
    })
  }

  const updateRefItem = (gIdx: number, iIdx: number, patch: Partial<Seedance2RefItem>) => {
    updateRefGroup(gIdx, {
      items: draft.refGroups[gIdx].items.map((it, i) => (i === iIdx ? { ...it, ...patch } : it))
    })
  }

  const addRefItem = (gIdx: number) => {
    updateRefGroup(gIdx, {
      items: [
        ...draft.refGroups[gIdx].items,
        { emoji: '🖼', label: `图片${draft.refGroups[gIdx].items.length + 1}`, note: '' }
      ]
    })
  }

  const deleteRefItem = (gIdx: number, iIdx: number) => {
    updateRefGroup(gIdx, { items: draft.refGroups[gIdx].items.filter((_, i) => i !== iIdx) })
  }

  const addRefGroup = () => {
    patchDraft({
      refGroups: [...draft.refGroups, { title: '新参考分组', description: '', items: [] }]
    })
  }

  const deleteRefGroup = (idx: number) => {
    patchDraft({ refGroups: draft.refGroups.filter((_, i) => i !== idx) })
  }

  const preview = useMemo(() => serializeTemplate(draft), [draft])

  const copyPreview = async () => {
    await navigator.clipboard.writeText(preview)
    alert('已复制到剪贴板')
  }

  const segmentIds = draft.segments.map((s) => s.id)

  return (
    <section className="page-body s2-layout">
      {/* 左：模板 / 预设列表 */}
      <aside className="s2-aside">
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="s2-btn s2-btn-primary" style={{ flex: 1 }} onClick={handleNew}>
            + 新建
          </button>
          <button type="button" className="s2-btn s2-btn-ghost" onClick={() => setShowPresets((v) => !v)}>
            {showPresets ? '隐藏预设' : '显示预设'}
          </button>
        </div>

        <div className="s2-aside-title">模板</div>
        {templates.length === 0 && <div className="s2-list-empty">暂无</div>}
        {templates.map((t) => (
          <div
            key={t.id}
            className="s2-list-item"
            data-active={t.id === currentId}
            onClick={() => loadTemplate(t)}
          >
            {t.title}
          </div>
        ))}

        {showPresets && (
          <>
            <div className="s2-aside-title" style={{ marginTop: 10 }}>片段预设</div>
            {presets.length === 0 && <div className="s2-list-empty">暂无</div>}
            {presets.map((p) => (
              <div key={p.id} className="s2-preset-item">
                <span className="s2-preset-item-name" onClick={() => insertPreset(p)} title="点击追加到末尾">
                  {p.name}
                </span>
                <button type="button" className="s2-btn s2-btn-icon" onClick={() => void deletePreset(p.id)} title="删除预设">
                  ×
                </button>
              </div>
            ))}
          </>
        )}
      </aside>

      {/* 中：编辑区 */}
      <div className="s2-main">
        <div className="s2-toolbar">
          <input
            className="s2-input s2-title-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setDirty(true)
            }}
            placeholder="模板标题"
          />
          <button
            type="button"
            className="s2-btn s2-btn-primary"
            onClick={() => void handleSave()}
            disabled={!dirty && !!currentId}
          >
            {currentId ? (dirty ? '保存修改*' : '已保存') : '保存为新模板'}
          </button>
          {currentId && (
            <button type="button" className="s2-btn" onClick={() => void handleDelete()}>
              删除
            </button>
          )}
        </div>

        <div className="s2-section">
          <div className="s2-section-header">
            <span className="s2-section-title">开篇总述</span>
            <span className="s2-hint">视频整体氛围 / 时长 / 色调</span>
          </div>
          <textarea
            className="s2-textarea"
            value={draft.intro}
            onChange={(e) => patchDraft({ intro: e.target.value })}
            rows={3}
          />
        </div>

        {draft.refGroups.map((group, gIdx) => (
          <div key={gIdx} className="s2-section">
            <div className="s2-section-header">
              <input
                className="s2-input"
                value={group.title}
                onChange={(e) => updateRefGroup(gIdx, { title: e.target.value })}
                placeholder="分组标题"
                style={{ flex: 1, fontWeight: 600 }}
              />
              <button type="button" className="s2-btn s2-btn-ghost" onClick={() => addRefItem(gIdx)}>
                + 参考图
              </button>
              <button type="button" className="s2-btn s2-btn-ghost" onClick={() => deleteRefGroup(gIdx)}>
                删除分组
              </button>
            </div>
            <textarea
              className="s2-textarea"
              value={group.description}
              onChange={(e) => updateRefGroup(gIdx, { description: e.target.value })}
              rows={2}
              placeholder="分组说明（可空，允许内嵌 🖐图片1 引用）"
            />
            {group.items.map((item, iIdx) => (
              <div key={iIdx} className="s2-ref-row">
                <input
                  className="s2-input emoji"
                  value={item.emoji}
                  onChange={(e) => updateRefItem(gIdx, iIdx, { emoji: e.target.value })}
                  placeholder="🖐"
                />
                <input
                  className="s2-input label"
                  value={item.label}
                  onChange={(e) => updateRefItem(gIdx, iIdx, { label: e.target.value })}
                  placeholder="图片1"
                />
                <input
                  className="s2-input"
                  value={item.note}
                  onChange={(e) => updateRefItem(gIdx, iIdx, { note: e.target.value })}
                  placeholder="说明"
                  style={{ flex: 1 }}
                />
                <button type="button" className="s2-btn s2-btn-icon" onClick={() => deleteRefItem(gIdx, iIdx)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}
        <div>
          <button type="button" className="s2-btn" onClick={addRefGroup}>
            + 参考分组
          </button>
        </div>

        <div className="s2-section">
          <div className="s2-section-header">
            <span className="s2-section-title">镜头序列（可拖拽排序）</span>
            <button type="button" className="s2-btn s2-btn-primary" onClick={addSegment}>
              + 新增镜头
            </button>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={segmentIds} strategy={verticalListSortingStrategy}>
              {draft.segments.map((seg, idx) => (
                <SortableSegment
                  key={seg.id}
                  segment={seg}
                  index={idx}
                  onChange={(p) => updateSegment(seg.id, p)}
                  onDelete={() => deleteSegment(seg.id)}
                  onDuplicate={() => duplicateSegment(seg.id)}
                  onSaveAsPreset={() => void saveSegmentAsPreset(seg)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <div>
            <div className="s2-hint" style={{ marginBottom: 4 }}>序列底部说明</div>
            <textarea
              className="s2-textarea"
              value={draft.segmentsFooter}
              onChange={(e) => patchDraft({ segmentsFooter: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        <div className="s2-section">
          <div className="s2-section-header">
            <span className="s2-section-title">风格</span>
          </div>
          <textarea
            className="s2-textarea"
            value={draft.style}
            onChange={(e) => patchDraft({ style: e.target.value })}
            rows={4}
          />
        </div>
      </div>

      {/* 右：实时预览 */}
      <aside className="s2-preview-wrap">
        <div className="s2-preview-header">
          <span className="s2-section-title">实时预览</span>
          <button type="button" className="s2-btn s2-btn-primary" onClick={() => void copyPreview()}>
            复制全文
          </button>
        </div>
        <pre className="s2-preview">{preview}</pre>
      </aside>
    </section>
  )
}
