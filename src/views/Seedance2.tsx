import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { WorkspaceLayout } from '../components/layout/WorkspaceLayout'
import type { NavigationRequest } from '../stores/appStore'
import { useAppStore } from '../stores/appStore'
import type { Seedance2PresetRecord, Seedance2RefGroup, Seedance2RefItem, Seedance2Segment, Seedance2TemplateData, Seedance2TemplateRecord } from '../shared/types'
import { SortableSegment } from './seedance2/SortableSegment'
import { DestructiveConfirmationDialog } from './seedance2/DestructiveConfirmationDialog'
import { PresetSaveDialog } from './seedance2/PresetSaveDialog'
import { SeedancePreviewPanel } from './seedance2/SeedancePreviewPanel'
import { SeedanceSection } from './seedance2/SeedanceSection'
import { emptySegment, emptyTemplate, serializeTemplate } from './seedance2/serialize'
import { UnsavedChangesDialog } from './seedance2/UnsavedChangesDialog'

const api = () => window.promptHub.seedance2
type PendingAction = { type: 'load'; template: Seedance2TemplateRecord } | { type: 'new' } | { type: 'delete' } | { type: 'navigate'; request: NavigationRequest }
type DestructiveTarget = { type: 'template'; id: string; name: string } | { type: 'preset'; id: string; name: string }
type Section = 'intro' | 'references' | 'shots' | 'style'
type ResourceTab = 'templates' | 'presets' | 'references'
const sectionNames: Record<Section, string> = { intro: '开篇总述', references: '参考资料', shots: '镜头序列', style: '风格' }

export function Seedance2() {
  const [templates, setTemplates] = useState<Seedance2TemplateRecord[]>([])
  const [presets, setPresets] = useState<Seedance2PresetRecord[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Seedance2TemplateData>(emptyTemplate)
  const [title, setTitle] = useState('未命名模板')
  const [dirty, setDirty] = useState(false)
  const [activeSection, setActiveSection] = useState<Section | null>('intro')
  const [resourceTab, setResourceTab] = useState<ResourceTab>('templates')
  const [destructive, setDestructive] = useState<DestructiveTarget | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [presetDraft, setPresetDraft] = useState<{ name: string; segment: Seedance2Segment; created: boolean } | null>(null)
  const [presetSaving, setPresetSaving] = useState(false)
  const [presetError, setPresetError] = useState<string | null>(null)
  const revision = useRef(0)
  const savingRef = useRef(false)
  const setNavigationGuard = useAppStore((s) => s.setNavigationGuard)
  const refs = useRef<Record<Section, HTMLElement | null>>({ intro: null, references: null, shots: null, style: null })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const reloadTemplates = async () => { const list = await api().listTemplates(); setTemplates(list); return list }
  const reloadPresets = async () => setPresets(await api().listPresets())
  useEffect(() => { void api().listTemplates().then(setTemplates); void api().listPresets().then(setPresets) }, [])

  const load = (rec: Seedance2TemplateRecord) => { revision.current++; setCurrentId(rec.id); setTitle(rec.title); setDraft(rec.data); setDirty(false) }
  const createNew = () => { revision.current++; setCurrentId(null); setTitle('未命名模板'); setDraft(emptyTemplate()); setDirty(true) }
  const request = (action: PendingAction) => { if (dirty) setPending(action); else perform(action) }
  const perform = (action: PendingAction) => {
    setPending(null); setSaveError(null)
    if (action.type === 'load') load(action.template)
    else if (action.type === 'new') createNew()
    else if (action.type === 'navigate') { setNavigationGuard(null); useAppStore.getState().continueNavigation(action.request) }
    else if (action.type === 'delete' && currentId) setDestructive({ type: 'template', id: currentId, name: title })
  }

  useEffect(() => {
    if (!dirty) { setNavigationGuard(null); return }
    setNavigationGuard((request) => { setPending({ type: 'navigate', request }); return true })
    return () => setNavigationGuard(null)
  }, [dirty, setNavigationGuard])

  const save = async () => {
    if (savingRef.current) return false
    savingRef.current = true
    const savedRevision = revision.current
    const savedId = currentId
    const savedTitle = title
    const savedDraft = structuredClone(draft)
    setSaving(true); setSaveError(null)
    try {
      const rec = savedId
        ? await api().updateTemplate(savedId, { title: savedTitle, data: savedDraft })
        : await api().createTemplate({ title: savedTitle, data: savedDraft })
      await reloadTemplates(); setCurrentId(rec.id)
      const unchanged = revision.current === savedRevision
      if (unchanged) setDirty(false)
      return unchanged
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '保存失败')
      return false
    } finally { savingRef.current = false; setSaving(false) }
  }
  const saveAndContinue = async () => {
    if (!pending) return
    if (await save()) perform(pending)
  }
  const patchDraft = (patch: Partial<Seedance2TemplateData>) => { revision.current++; setDraft((prev) => ({ ...prev, ...patch })); setDirty(true) }
  const updateSegment = (id: string, patch: Partial<Seedance2Segment>) => patchDraft({ segments: draft.segments.map((s) => s.id === id ? { ...s, ...patch } : s) })
  const dragEnd = ({ active, over }: DragEndEvent) => { if (!over || active.id === over.id) return; const from = draft.segments.findIndex((s) => s.id === active.id); const to = draft.segments.findIndex((s) => s.id === over.id); if (from >= 0 && to >= 0) patchDraft({ segments: arrayMove(draft.segments, from, to) }) }
  const updateRefGroup = (index: number, patch: Partial<Seedance2RefGroup>) => patchDraft({ refGroups: draft.refGroups.map((g, i) => i === index ? { ...g, ...patch } : g) })
  const updateRefItem = (g: number, i: number, patch: Partial<Seedance2RefItem>) => updateRefGroup(g, { items: draft.refGroups[g].items.map((item, index) => index === i ? { ...item, ...patch } : item) })
  const beginPresetSave = (segment: Seedance2Segment) => {
    setPresetError(null)
    setPresetDraft({
      name: segment.timeLabel || segment.shotType || '镜头预设',
      segment: { ...segment, id: crypto.randomUUID() },
      created: false
    })
  }
  const savePreset = async () => {
    if (!presetDraft || presetSaving) return
    setPresetSaving(true); setPresetError(null)
    let created = presetDraft.created
    try {
      if (!created) {
        await api().createPreset({ name: presetDraft.name.trim(), segment: presetDraft.segment, tags: [] })
        created = true
        setPresetDraft((value) => value ? { ...value, created: true } : value)
      }
      await reloadPresets()
      setPresetDraft(null)
    } catch (error) {
      setPresetError(error instanceof Error ? error.message : '预设保存失败')
      if (created) setPresetDraft((value) => value ? { ...value, created: true } : value)
    } finally { setPresetSaving(false) }
  }
  const preview = useMemo(() => serializeTemplate(draft), [draft])
  const executeDestructive = async () => {
    if (!destructive || deleting) return
    setDeleting(true); setDeleteError(null)
    try {
      if (destructive.type === 'template') {
        await api().deleteTemplate(destructive.id); await reloadTemplates()
        revision.current++; setCurrentId(null); setTitle('未命名模板'); setDraft(emptyTemplate()); setDirty(false)
      } else { await api().deletePreset(destructive.id); await reloadPresets() }
      setDestructive(null)
    } catch (error) { setDeleteError(error instanceof Error ? error.message : '删除失败') }
    finally { setDeleting(false) }
  }
  const copyPreview = async () => {
    setCopyStatus(null)
    try { await navigator.clipboard.writeText(preview); setCopyStatus({ kind: 'success', text: '已复制' }) }
    catch (error) { setCopyStatus({ kind: 'error', text: error instanceof Error ? error.message : '复制失败' }) }
  }

  const openSection = (section: Section) => { setActiveSection(section); requestAnimationFrame(() => { const node = refs.current[section]; node?.scrollIntoView?.({ block: 'start' }); node?.querySelector<HTMLElement>('textarea, input, button')?.focus() }) }
  const toggleSection = (section: Section) => setActiveSection((active) => active === section ? null : section)
  const accordion = (section: Section, children: ReactNode) => <SeedanceSection
    id={section}
    title={sectionNames[section]}
    expanded={activeSection === section}
    sectionRef={(node) => { refs.current[section] = node }}
    onToggle={() => toggleSection(section)}
  >{children}</SeedanceSection>

  const tabs: Array<{ id: ResourceTab; label: string }> = [{ id: 'templates', label: '模板' }, { id: 'presets', label: '预设' }, { id: 'references', label: '参考' }]
  const tabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: ResourceTab) => {
    const index = tabs.findIndex((item) => item.id === tab)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : -1
    if (next < 0) return
    event.preventDefault(); setResourceTab(tabs[next].id); requestAnimationFrame(() => document.getElementById(`seedance-tab-${tabs[next].id}`)?.focus())
  }
  const resource = <aside className="s2-resource" aria-label="Seedance2 资源">
    <div role="tablist" aria-label="Seedance2 资源类型">{tabs.map((tab) => <button key={tab.id} id={`seedance-tab-${tab.id}`} type="button" role="tab" aria-selected={resourceTab === tab.id} aria-controls={`seedance-resource-${tab.id}`} tabIndex={resourceTab === tab.id ? 0 : -1} onClick={() => setResourceTab(tab.id)} onKeyDown={(event) => tabKeyDown(event, tab.id)}>{tab.label}</button>)}</div>
    <div role="tabpanel" id={`seedance-resource-${resourceTab}`} aria-labelledby={`seedance-tab-${resourceTab}`}>
      {resourceTab === 'templates' && <><button type="button" className="s2-btn s2-btn-primary" onClick={() => request({ type: 'new' })}>+ 新建</button>{templates.map((item) => <button type="button" className="s2-list-item" data-active={item.id === currentId} key={item.id} onClick={() => request({ type: 'load', template: item })}>{item.title}</button>)}</>}
      {resourceTab === 'presets' && presets.map((preset) => <div className="s2-preset-item" key={preset.id}><button type="button" onClick={() => patchDraft({ segments: [...draft.segments, { ...preset.segment, id: crypto.randomUUID() }] })}>{preset.name}</button><button type="button" aria-label={`删除预设 ${preset.name}`} onClick={() => setDestructive({ type: 'preset', id: preset.id, name: preset.name })}>×</button></div>)}
      {resourceTab === 'references' && draft.refGroups.map((group, index) => <button type="button" className="s2-list-item" key={index} onClick={() => { openSection('references'); requestAnimationFrame(() => document.getElementById(`seedance-ref-group-${index}`)?.querySelector<HTMLElement>('input')?.focus()) }}>{group.title || `参考分组 ${index + 1}`}</button>)}
    </div>
  </aside>

  const main = <main className="s2-main" aria-label="Seedance2 编辑器">
    <div className="s2-toolbar"><label><span className="sr-only">模板标题</span><input className="s2-input s2-title-input" value={title} onChange={(e) => { revision.current++; setTitle(e.target.value); setDirty(true) }} /></label><button className="s2-btn s2-btn-primary" disabled={saving || (!dirty && !!currentId)} onClick={() => void save()}>{saving ? '保存中…' : currentId ? '保存' : '保存为新模板'}</button>{currentId && <button className="s2-btn" disabled={saving} onClick={() => dirty ? request({ type: 'delete' }) : setDestructive({ type: 'template', id: currentId, name: title })}>删除</button>}{saveError && !pending && <span role="alert">{saveError}</span>}</div>
    <nav className="s2-section-nav" aria-label="编辑器分区">{(Object.keys(sectionNames) as Section[]).map((section) => <button key={section} type="button" aria-current={activeSection === section ? 'true' : undefined} onClick={() => openSection(section)}>{sectionNames[section]}</button>)}</nav>
    <div className="s2-editor-scroll">
      {accordion('intro', <textarea aria-label="开篇总述内容" className="s2-textarea" rows={5} value={draft.intro} onChange={(e) => patchDraft({ intro: e.target.value })} />)}
      {accordion('references', <><button className="s2-btn" onClick={() => patchDraft({ refGroups: [...draft.refGroups, { title: '新参考分组', description: '', items: [] }] })}>+ 参考分组</button>{draft.refGroups.map((group, g) => <div id={`seedance-ref-group-${g}`} className="s2-ref-group" key={g}><input aria-label={`参考分组 ${g + 1} 标题`} className="s2-input" value={group.title} onChange={(e) => updateRefGroup(g, { title: e.target.value })} /><textarea className="s2-textarea" value={group.description} onChange={(e) => updateRefGroup(g, { description: e.target.value })} /><button className="s2-btn" onClick={() => updateRefGroup(g, { items: [...group.items, { emoji: '🖼️', label: `图片${group.items.length + 1}`, note: '' }] })}>+ 参考图</button><button className="s2-btn" onClick={() => patchDraft({ refGroups: draft.refGroups.filter((_, i) => i !== g) })}>删除分组</button>{group.items.map((item, i) => <div className="s2-ref-row" key={i}><input className="s2-input" value={item.emoji} onChange={(e) => updateRefItem(g, i, { emoji: e.target.value })} /><input className="s2-input" value={item.label} onChange={(e) => updateRefItem(g, i, { label: e.target.value })} /><input className="s2-input" value={item.note} onChange={(e) => updateRefItem(g, i, { note: e.target.value })} /><button onClick={() => updateRefGroup(g, { items: group.items.filter((_, x) => x !== i) })}>×</button></div>)}</div>)}</>)}
      {accordion('shots', <><button className="s2-btn s2-btn-primary" onClick={() => patchDraft({ segments: [...draft.segments, emptySegment()] })}>+ 新增镜头</button><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}><SortableContext items={draft.segments.map((s) => s.id)} strategy={verticalListSortingStrategy}>{draft.segments.map((segment, index) => <SortableSegment key={segment.id} segment={segment} index={index} onChange={(patch) => updateSegment(segment.id, patch)} onDelete={() => patchDraft({ segments: draft.segments.filter((s) => s.id !== segment.id) })} onDuplicate={() => { const at = draft.segments.findIndex((s) => s.id === segment.id); const next = [...draft.segments]; next.splice(at + 1, 0, { ...segment, id: crypto.randomUUID() }); patchDraft({ segments: next }) }} onSaveAsPreset={() => beginPresetSave(segment)} />)}</SortableContext></DndContext><textarea aria-label="镜头序列底部说明" className="s2-textarea" value={draft.segmentsFooter} onChange={(e) => patchDraft({ segmentsFooter: e.target.value })} /></>)}
      {accordion('style', <textarea aria-label="风格内容" className="s2-textarea" rows={6} value={draft.style} onChange={(e) => patchDraft({ style: e.target.value })} />)}
    </div>
  </main>
  const detail = <SeedancePreviewPanel preview={preview} copyStatus={copyStatus} onCopy={() => void copyPreview()} />

  return <><WorkspaceLayout resource={resource} resourceLabel="Seedance2 资源" main={main} detail={detail} detailLabel="实时预览" />{pending && <UnsavedChangesDialog saving={saving} error={saveError} onSave={() => void saveAndContinue()} onDiscard={() => perform(pending)} onCancel={() => { setPending(null); setSaveError(null) }} />}{destructive && <DestructiveConfirmationDialog kind={destructive.type === 'template' ? '模板' : '预设'} name={destructive.name} pending={deleting} error={deleteError} onCancel={() => { setDestructive(null); setDeleteError(null) }} onConfirm={() => void executeDestructive()} />}{presetDraft && <PresetSaveDialog name={presetDraft.name} pending={presetSaving} error={presetError} onNameChange={(name) => setPresetDraft((value) => value ? { ...value, name } : value)} onCancel={() => { setPresetDraft(null); setPresetError(null) }} onSave={() => void savePreset()} />}</>
}
