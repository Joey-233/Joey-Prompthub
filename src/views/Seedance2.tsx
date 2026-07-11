import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { WorkspaceLayout } from '../components/layout/WorkspaceLayout'
import type { AppView } from '../stores/appStore'
import { useAppStore } from '../stores/appStore'
import type { Seedance2PresetRecord, Seedance2RefGroup, Seedance2RefItem, Seedance2Segment, Seedance2TemplateData, Seedance2TemplateRecord } from '../shared/types'
import { SortableSegment } from './seedance2/SortableSegment'
import { emptySegment, emptyTemplate, serializeTemplate } from './seedance2/serialize'
import { UnsavedChangesDialog } from './seedance2/UnsavedChangesDialog'

const api = () => window.promptHub.seedance2
type PendingAction = { type: 'load'; template: Seedance2TemplateRecord } | { type: 'new' } | { type: 'delete' } | { type: 'navigate'; view: AppView }
type Section = 'intro' | 'references' | 'shots' | 'style'
const sectionNames: Record<Section, string> = { intro: '开篇总述', references: '参考资料', shots: '镜头序列', style: '风格' }

export function Seedance2() {
  const [templates, setTemplates] = useState<Seedance2TemplateRecord[]>([])
  const [presets, setPresets] = useState<Seedance2PresetRecord[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Seedance2TemplateData>(emptyTemplate)
  const [title, setTitle] = useState('未命名模板')
  const [dirty, setDirty] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('intro')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const setNavigationGuard = useAppStore((s) => s.setNavigationGuard)
  const refs = useRef<Record<Section, HTMLElement | null>>({ intro: null, references: null, shots: null, style: null })

  const reloadTemplates = useCallback(async () => { const list = await api().listTemplates(); setTemplates(list); return list }, [])
  const reloadPresets = useCallback(async () => setPresets(await api().listPresets()), [])
  useEffect(() => { void reloadTemplates(); void reloadPresets() }, [reloadPresets, reloadTemplates])

  const load = useCallback((rec: Seedance2TemplateRecord) => { setCurrentId(rec.id); setTitle(rec.title); setDraft(rec.data); setDirty(false) }, [])
  const createNew = useCallback(() => { setCurrentId(null); setTitle('未命名模板'); setDraft(emptyTemplate()); setDirty(true) }, [])
  const request = useCallback((action: PendingAction) => { if (dirty) setPending(action); else perform(action) }, [dirty])
  const perform = useCallback((action: PendingAction) => {
    setPending(null); setSaveError(null)
    if (action.type === 'load') load(action.template)
    else if (action.type === 'new') createNew()
    else if (action.type === 'navigate') { setNavigationGuard(null); useAppStore.getState().setCurrentView(action.view) }
    else if (action.type === 'delete' && currentId) void api().deleteTemplate(currentId).then(async () => { await reloadTemplates(); setCurrentId(null); setTitle('未命名模板'); setDraft(emptyTemplate()); setDirty(false) })
  }, [createNew, currentId, load, reloadTemplates, setNavigationGuard])

  useEffect(() => {
    if (!dirty) { setNavigationGuard(null); return }
    setNavigationGuard((view) => { setPending({ type: 'navigate', view }); return true })
    return () => setNavigationGuard(null)
  }, [dirty, setNavigationGuard])

  const save = async () => {
    const rec = currentId
      ? await api().updateTemplate(currentId, { title, data: draft })
      : await api().createTemplate({ title, data: draft })
    await reloadTemplates(); setCurrentId(rec.id); setDirty(false); return rec
  }
  const saveAndContinue = async () => {
    if (!pending) return
    setSaving(true); setSaveError(null)
    try { await save(); perform(pending) }
    catch (error) { setSaveError(error instanceof Error ? error.message : '保存失败') }
    finally { setSaving(false) }
  }
  const patchDraft = (patch: Partial<Seedance2TemplateData>) => { setDraft((prev) => ({ ...prev, ...patch })); setDirty(true) }
  const updateSegment = (id: string, patch: Partial<Seedance2Segment>) => patchDraft({ segments: draft.segments.map((s) => s.id === id ? { ...s, ...patch } : s) })
  const dragEnd = ({ active, over }: DragEndEvent) => { if (!over || active.id === over.id) return; const from = draft.segments.findIndex((s) => s.id === active.id); const to = draft.segments.findIndex((s) => s.id === over.id); if (from >= 0 && to >= 0) patchDraft({ segments: arrayMove(draft.segments, from, to) }) }
  const updateRefGroup = (index: number, patch: Partial<Seedance2RefGroup>) => patchDraft({ refGroups: draft.refGroups.map((g, i) => i === index ? { ...g, ...patch } : g) })
  const updateRefItem = (g: number, i: number, patch: Partial<Seedance2RefItem>) => updateRefGroup(g, { items: draft.refGroups[g].items.map((item, index) => index === i ? { ...item, ...patch } : item) })
  const savePreset = async (segment: Seedance2Segment) => { const name = prompt('预设名称', segment.timeLabel || segment.shotType || '镜头预设'); if (!name) return; await api().createPreset({ name, segment: { ...segment, id: crypto.randomUUID() }, tags: [] }); await reloadPresets() }
  const preview = useMemo(() => serializeTemplate(draft), [draft])

  const openSection = (section: Section) => { setActiveSection(section); requestAnimationFrame(() => { refs.current[section]?.scrollIntoView({ block: 'start' }); refs.current[section]?.querySelector<HTMLElement>('textarea, input, button')?.focus() }) }
  const accordion = (section: Section, children: ReactNode) => <section ref={(node) => { refs.current[section] = node }} className="s2-accordion">
    <h2><button type="button" aria-expanded={activeSection === section} aria-controls={`seedance-section-${section}`} onClick={() => openSection(section)}>{sectionNames[section]}</button></h2>
    <div id={`seedance-section-${section}`} hidden={activeSection !== section}>{children}</div>
  </section>

  const resource = <aside className="s2-resource" aria-label="Seedance2 资源">
    <div role="tablist" aria-label="Seedance2 资源类型"><button role="tab" aria-selected="true">模板</button><button role="tab" aria-selected="false">预设</button></div>
    <button type="button" className="s2-btn s2-btn-primary" onClick={() => request({ type: 'new' })}>+ 新建</button>
    <h2>模板</h2>{templates.map((item) => <button type="button" className="s2-list-item" data-active={item.id === currentId} key={item.id} onClick={() => request({ type: 'load', template: item })}>{item.title}</button>)}
    <h2>镜头预设</h2>{presets.map((preset) => <div className="s2-preset-item" key={preset.id}><button type="button" onClick={() => patchDraft({ segments: [...draft.segments, { ...preset.segment, id: crypto.randomUUID() }] })}>{preset.name}</button><button type="button" aria-label={`删除预设 ${preset.name}`} onClick={async () => { await api().deletePreset(preset.id); await reloadPresets() }}>×</button></div>)}
  </aside>

  const main = <main className="s2-main" aria-label="Seedance2 编辑器">
    <div className="s2-toolbar"><label><span className="sr-only">模板标题</span><input className="s2-input s2-title-input" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true) }} /></label><button className="s2-btn s2-btn-primary" disabled={!dirty && !!currentId} onClick={() => void save()}>{currentId ? '保存' : '保存为新模板'}</button>{currentId && <button className="s2-btn" onClick={() => request({ type: 'delete' })}>删除</button>}</div>
    <nav className="s2-section-nav" aria-label="编辑器分区">{(Object.keys(sectionNames) as Section[]).map((section) => <button key={section} type="button" aria-current={activeSection === section ? 'true' : undefined} onClick={() => openSection(section)}>{sectionNames[section]}</button>)}</nav>
    <div className="s2-editor-scroll">
      {accordion('intro', <textarea aria-label="开篇总述内容" className="s2-textarea" rows={5} value={draft.intro} onChange={(e) => patchDraft({ intro: e.target.value })} />)}
      {accordion('references', <><button className="s2-btn" onClick={() => patchDraft({ refGroups: [...draft.refGroups, { title: '新参考分组', description: '', items: [] }] })}>+ 参考分组</button>{draft.refGroups.map((group, g) => <div className="s2-ref-group" key={g}><input aria-label={`参考分组 ${g + 1} 标题`} className="s2-input" value={group.title} onChange={(e) => updateRefGroup(g, { title: e.target.value })} /><textarea className="s2-textarea" value={group.description} onChange={(e) => updateRefGroup(g, { description: e.target.value })} /><button className="s2-btn" onClick={() => updateRefGroup(g, { items: [...group.items, { emoji: '🖼️', label: `图片${group.items.length + 1}`, note: '' }] })}>+ 参考图</button><button className="s2-btn" onClick={() => patchDraft({ refGroups: draft.refGroups.filter((_, i) => i !== g) })}>删除分组</button>{group.items.map((item, i) => <div className="s2-ref-row" key={i}><input className="s2-input" value={item.emoji} onChange={(e) => updateRefItem(g, i, { emoji: e.target.value })} /><input className="s2-input" value={item.label} onChange={(e) => updateRefItem(g, i, { label: e.target.value })} /><input className="s2-input" value={item.note} onChange={(e) => updateRefItem(g, i, { note: e.target.value })} /><button onClick={() => updateRefGroup(g, { items: group.items.filter((_, x) => x !== i) })}>×</button></div>)}</div>)}</>)}
      {accordion('shots', <><button className="s2-btn s2-btn-primary" onClick={() => patchDraft({ segments: [...draft.segments, emptySegment()] })}>+ 新增镜头</button><DndContext collisionDetection={closestCenter} onDragEnd={dragEnd}><SortableContext items={draft.segments.map((s) => s.id)} strategy={verticalListSortingStrategy}>{draft.segments.map((segment, index) => <SortableSegment key={segment.id} segment={segment} index={index} onChange={(patch) => updateSegment(segment.id, patch)} onDelete={() => patchDraft({ segments: draft.segments.filter((s) => s.id !== segment.id) })} onDuplicate={() => { const at = draft.segments.findIndex((s) => s.id === segment.id); const next = [...draft.segments]; next.splice(at + 1, 0, { ...segment, id: crypto.randomUUID() }); patchDraft({ segments: next }) }} onSaveAsPreset={() => void savePreset(segment)} />)}</SortableContext></DndContext><textarea aria-label="镜头序列底部说明" className="s2-textarea" value={draft.segmentsFooter} onChange={(e) => patchDraft({ segmentsFooter: e.target.value })} /></>)}
      {accordion('style', <textarea aria-label="风格内容" className="s2-textarea" rows={6} value={draft.style} onChange={(e) => patchDraft({ style: e.target.value })} />)}
    </div>
  </main>
  const detail = <aside className="s2-preview-wrap" aria-label="实时预览"><div className="s2-preview-header"><strong>实时预览</strong><button className="s2-btn s2-btn-primary" onClick={() => void navigator.clipboard.writeText(preview)}>复制</button></div><pre className="s2-preview">{preview}</pre></aside>

  return <><WorkspaceLayout resource={resource} resourceLabel="Seedance2 资源" main={main} detail={detail} detailLabel="实时预览" />{pending && <UnsavedChangesDialog saving={saving} error={saveError} onSave={() => void saveAndContinue()} onDiscard={() => perform(pending)} onCancel={() => { setPending(null); setSaveError(null) }} />}</>
}
