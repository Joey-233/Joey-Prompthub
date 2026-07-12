import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { WorkspaceLayout } from '../components/layout/WorkspaceLayout'
import type { NavigationRequest } from '../stores/appStore'
import { useAppStore } from '../stores/appStore'
import type { Seedance2PresetRecord, Seedance2RefGroup, Seedance2RefItem, Seedance2Segment, Seedance2TemplateData, Seedance2TemplateRecord, Seedance2TemplateSection } from '../shared/types'
import { DestructiveConfirmationDialog } from './seedance2/DestructiveConfirmationDialog'
import { PresetSaveDialog } from './seedance2/PresetSaveDialog'
import { SeedancePreviewPanel } from './seedance2/SeedancePreviewPanel'
import { SeedanceSection } from './seedance2/SeedanceSection'
import { SortableSegment } from './seedance2/SortableSegment'
import { emptySegment, emptyTemplate, normalizeTemplateData, serializeTemplate } from './seedance2/serialize'
import { UnsavedChangesDialog } from './seedance2/UnsavedChangesDialog'

const api = () => window.promptHub.seedance2
type PendingAction = { type: 'load'; template: Seedance2TemplateRecord } | { type: 'new' } | { type: 'delete' } | { type: 'navigate'; request: NavigationRequest }
type DestructiveTarget = { type: 'template'; id: string; name: string } | { type: 'preset'; id: string; name: string } | { type: 'section'; id: string; name: string }
type ResourceTab = 'templates' | 'presets' | 'references'
type AddableSectionKind = 'text' | 'intro' | 'references' | 'shots' | 'style'

const addableSectionLabels: Array<{ kind: AddableSectionKind; label: string }> = [
  { kind: 'text', label: '自定义文本类目' },
  { kind: 'intro', label: '开篇总述' },
  { kind: 'references', label: '参考资料' },
  { kind: 'shots', label: '镜头序列' },
  { kind: 'style', label: '风格' }
]

function createBlankSection(kind: AddableSectionKind): Seedance2TemplateSection {
  if (kind === 'references') return { id: 'references', title: '参考资料', kind: 'references', refGroups: [] }
  if (kind === 'shots') return { id: 'shots', title: '镜头序列', kind: 'shots', segments: [], footer: '' }
  if (kind === 'intro') return { id: 'intro', title: '开篇总述', kind: 'text', content: '' }
  if (kind === 'style') return { id: 'style', title: '风格', kind: 'text', content: '' }
  return { id: crypto.randomUUID(), title: '新类目', kind: 'text', content: '' }
}

function hasSectionContent(section: Seedance2TemplateSection) {
  if (section.kind === 'text') return Boolean(section.content.trim())
  if (section.kind === 'references') return section.refGroups.length > 0
  return section.segments.length > 0 || Boolean(section.footer.trim())
}

export function Seedance2() {
  const [templates, setTemplates] = useState<Seedance2TemplateRecord[]>([])
  const [presets, setPresets] = useState<Seedance2PresetRecord[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Seedance2TemplateData>(emptyTemplate)
  const [title, setTitle] = useState('未命名模板')
  const [dirty, setDirty] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState<string | null>('intro')
  const [isAddMenuOpen, setAddMenuOpen] = useState(false)
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
  const refs = useRef<Record<string, HTMLElement | null>>({})
  const setNavigationGuard = useAppStore((state) => state.setNavigationGuard)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const reloadTemplates = async () => { const list = await api().listTemplates(); setTemplates(list); return list }
  const reloadPresets = async () => setPresets(await api().listPresets())
  useEffect(() => { void api().listTemplates().then(setTemplates); void api().listPresets().then(setPresets) }, [])

  const load = (record: Seedance2TemplateRecord) => {
    const data = normalizeTemplateData(record.data)
    revision.current++
    setCurrentId(record.id)
    setTitle(record.title)
    setDraft(data)
    setActiveSectionId(data.sections[0]?.id ?? null)
    setDirty(false)
  }
  const createNew = () => {
    const data = emptyTemplate()
    revision.current++
    setCurrentId(null)
    setTitle('未命名模板')
    setDraft(data)
    setActiveSectionId(data.sections[0]?.id ?? null)
    setDirty(true)
  }
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

  const patchDraft = (updater: (current: Seedance2TemplateData) => Seedance2TemplateData) => {
    revision.current++
    setDraft((current) => updater(current))
    setDirty(true)
  }
  const updateSection = (id: string, updater: (section: Seedance2TemplateSection) => Seedance2TemplateSection) =>
    patchDraft((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? updater(section) : section) }))
  const updateTextSection = (id: string, content: string) => updateSection(id, (section) => section.kind === 'text' ? { ...section, content } : section)
  const updateRefGroup = (id: string, index: number, patch: Partial<Seedance2RefGroup>) => updateSection(id, (section) => section.kind === 'references'
    ? { ...section, refGroups: section.refGroups.map((group, groupIndex) => groupIndex === index ? { ...group, ...patch } : group) }
    : section)
  const updateRefItem = (sectionId: string, groupIndex: number, itemIndex: number, patch: Partial<Seedance2RefItem>) => {
    const section = draft.sections.find((item) => item.id === sectionId)
    if (section?.kind !== 'references') return
    updateRefGroup(sectionId, groupIndex, { items: section.refGroups[groupIndex].items.map((item, index) => index === itemIndex ? { ...item, ...patch } : item) })
  }
  const updateSegment = (sectionId: string, id: string, patch: Partial<Seedance2Segment>) => updateSection(sectionId, (section) => section.kind === 'shots'
    ? { ...section, segments: section.segments.map((segment) => segment.id === id ? { ...segment, ...patch } : segment) }
    : section)
  const dragEnd = (sectionId: string, { active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    updateSection(sectionId, (section) => {
      if (section.kind !== 'shots') return section
      const from = section.segments.findIndex((segment) => segment.id === active.id)
      const to = section.segments.findIndex((segment) => segment.id === over.id)
      return from >= 0 && to >= 0 ? { ...section, segments: arrayMove(section.segments, from, to) } : section
    })
  }

  const save = async () => {
    if (savingRef.current) return false
    savingRef.current = true
    const savedRevision = revision.current
    const savedId = currentId
    const savedTitle = title
    const savedDraft = structuredClone(draft)
    setSaving(true); setSaveError(null)
    try {
      const record = savedId
        ? await api().updateTemplate(savedId, { title: savedTitle, data: savedDraft })
        : await api().createTemplate({ title: savedTitle, data: savedDraft })
      await reloadTemplates(); setCurrentId(record.id)
      const unchanged = revision.current === savedRevision
      if (unchanged) setDirty(false)
      return unchanged
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '保存失败')
      return false
    } finally { savingRef.current = false; setSaving(false) }
  }
  const saveAndContinue = async () => { if (pending && await save()) perform(pending) }
  const beginPresetSave = (segment: Seedance2Segment) => {
    setPresetError(null)
    setPresetDraft({ name: segment.timeLabel || segment.shotType || '镜头预设', segment: { ...segment, id: crypto.randomUUID() }, created: false })
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
      await reloadPresets(); setPresetDraft(null)
    } catch (error) {
      setPresetError(error instanceof Error ? error.message : '预设保存失败')
      if (created) setPresetDraft((value) => value ? { ...value, created: true } : value)
    } finally { setPresetSaving(false) }
  }

  const removeSection = (id: string) => patchDraft((current) => {
    const next = current.sections.filter((section) => section.id !== id)
    setActiveSectionId((active) => active === id ? next[0]?.id ?? null : active)
    return { ...current, sections: next }
  })
  const requestDeleteSection = (section: Seedance2TemplateSection) => {
    if (hasSectionContent(section)) setDestructive({ type: 'section', id: section.id, name: section.title || '未命名类目' })
    else removeSection(section.id)
  }
  const addSection = (kind: AddableSectionKind) => {
    const section = createBlankSection(kind)
    patchDraft((current) => {
      const at = Math.max(0, current.sections.findIndex((item) => item.id === activeSectionId))
      const next = [...current.sections]
      next.splice(at + 1, 0, section)
      return { ...current, sections: next }
    })
    setActiveSectionId(section.id)
    setAddMenuOpen(false)
  }
  const moveSection = (id: string, direction: -1 | 1) => patchDraft((current) => {
    const from = current.sections.findIndex((section) => section.id === id)
    const to = from + direction
    return from >= 0 && to >= 0 && to < current.sections.length ? { ...current, sections: arrayMove(current.sections, from, to) } : current
  })
  const preview = useMemo(() => serializeTemplate(draft), [draft])
  const executeDestructive = async () => {
    if (!destructive || deleting) return
    setDeleting(true); setDeleteError(null)
    try {
      if (destructive.type === 'template') {
        await api().deleteTemplate(destructive.id); await reloadTemplates(); createNew(); setDirty(false)
      } else if (destructive.type === 'preset') {
        await api().deletePreset(destructive.id); await reloadPresets()
      } else removeSection(destructive.id)
      setDestructive(null)
    } catch (error) { setDeleteError(error instanceof Error ? error.message : '删除失败') }
    finally { setDeleting(false) }
  }
  const copyPreview = async () => {
    setCopyStatus(null)
    try { await navigator.clipboard.writeText(preview); setCopyStatus({ kind: 'success', text: '已复制' }) }
    catch (error) { setCopyStatus({ kind: 'error', text: error instanceof Error ? error.message : '复制失败' }) }
  }
  const openSection = (id: string) => {
    setActiveSectionId(id)
    requestAnimationFrame(() => { const node = refs.current[id]; node?.scrollIntoView?.({ block: 'start' }); node?.querySelector<HTMLElement>('textarea, input, button')?.focus() })
  }
  const toggleSection = (id: string) => setActiveSectionId((active) => active === id ? null : id)

  const renderSection = (section: Seedance2TemplateSection, index: number) => {
    const content = section.kind === 'text'
      ? <textarea aria-label={`${section.title || '未命名类目'}内容`} className="s2-textarea" rows={6} value={section.content} onChange={(event) => updateTextSection(section.id, event.target.value)} />
      : section.kind === 'references'
        ? <>
            <button className="s2-btn" onClick={() => updateSection(section.id, (current) => current.kind === 'references' ? { ...current, refGroups: [...current.refGroups, { title: '新参考分组', description: '', items: [] }] } : current)}>+ 参考分组</button>
            {section.refGroups.map((group, groupIndex) => <div id={`seedance-ref-group-${section.id}-${groupIndex}`} className="s2-ref-group" key={groupIndex}>
              <input aria-label={`参考分组 ${groupIndex + 1} 标题`} className="s2-input" value={group.title} onChange={(event) => updateRefGroup(section.id, groupIndex, { title: event.target.value })} />
              <textarea className="s2-textarea" value={group.description} onChange={(event) => updateRefGroup(section.id, groupIndex, { description: event.target.value })} />
              <button className="s2-btn" onClick={() => updateRefGroup(section.id, groupIndex, { items: [...group.items, { emoji: '🖼️', label: `图片${group.items.length + 1}`, note: '' }] })}>+ 参考图</button>
              <button className="s2-btn" onClick={() => updateSection(section.id, (current) => current.kind === 'references' ? { ...current, refGroups: current.refGroups.filter((_, itemIndex) => itemIndex !== groupIndex) } : current)}>删除分组</button>
              {group.items.map((item, itemIndex) => <div className="s2-ref-row" key={itemIndex}>
                <input className="s2-input" value={item.emoji} onChange={(event) => updateRefItem(section.id, groupIndex, itemIndex, { emoji: event.target.value })} />
                <input className="s2-input" value={item.label} onChange={(event) => updateRefItem(section.id, groupIndex, itemIndex, { label: event.target.value })} />
                <input className="s2-input" value={item.note} onChange={(event) => updateRefItem(section.id, groupIndex, itemIndex, { note: event.target.value })} />
                <button type="button" onClick={() => updateRefGroup(section.id, groupIndex, { items: group.items.filter((_, itemToRemove) => itemToRemove !== itemIndex) })}>×</button>
              </div>)}
            </div>)}
          </>
        : <>
            <button className="s2-btn s2-btn-primary" onClick={() => updateSection(section.id, (current) => current.kind === 'shots' ? { ...current, segments: [...current.segments, emptySegment()] } : current)}>+ 新增镜头</button>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => dragEnd(section.id, event)}>
              <SortableContext items={section.segments.map((segment) => segment.id)} strategy={verticalListSortingStrategy}>
                {section.segments.map((segment, segmentIndex) => <SortableSegment key={segment.id} segment={segment} index={segmentIndex} onChange={(patch) => updateSegment(section.id, segment.id, patch)} onDelete={() => updateSection(section.id, (current) => current.kind === 'shots' ? { ...current, segments: current.segments.filter((item) => item.id !== segment.id) } : current)} onDuplicate={() => updateSection(section.id, (current) => {
                  if (current.kind !== 'shots') return current
                  const at = current.segments.findIndex((item) => item.id === segment.id)
                  const next = [...current.segments]
                  next.splice(at + 1, 0, { ...segment, id: crypto.randomUUID() })
                  return { ...current, segments: next }
                })} onSaveAsPreset={() => beginPresetSave(segment)} />)}
              </SortableContext>
            </DndContext>
            <textarea aria-label="镜头序列底部说明" className="s2-textarea" value={section.footer} onChange={(event) => updateSection(section.id, (current) => current.kind === 'shots' ? { ...current, footer: event.target.value } : current)} />
          </>

    return <SeedanceSection key={section.id} id={section.id} title={section.title} expanded={activeSectionId === section.id} sectionRef={(node) => { refs.current[section.id] = node }} onToggle={() => toggleSection(section.id)} onTitleChange={(value) => updateSection(section.id, (current) => ({ ...current, title: value }))} onTitleBlur={() => updateSection(section.id, (current) => ({ ...current, title: current.title.trim() || '未命名类目' }))} onDelete={() => requestDeleteSection(section)} onMoveEarlier={() => moveSection(section.id, -1)} onMoveLater={() => moveSection(section.id, 1)} canMoveEarlier={index > 0} canMoveLater={index < draft.sections.length - 1}>{content}</SeedanceSection>
  }

  const tabs: Array<{ id: ResourceTab; label: string }> = [{ id: 'templates', label: '模板' }, { id: 'presets', label: '预设' }, { id: 'references', label: '参考' }]
  const tabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: ResourceTab) => {
    const index = tabs.findIndex((item) => item.id === tab)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : -1
    if (next < 0) return
    event.preventDefault(); setResourceTab(tabs[next].id); requestAnimationFrame(() => document.getElementById(`seedance-tab-${tabs[next].id}`)?.focus())
  }
  const referenceSection = draft.sections.find((section) => section.kind === 'references')
  const shotsSection = draft.sections.find((section) => section.kind === 'shots')
  const defaultSectionExists = (kind: AddableSectionKind) => kind !== 'text' && draft.sections.some((section) => section.id === kind)
  const resource = <aside className="s2-resource" aria-label="Seedance2 资源">
    <div role="tablist" aria-label="Seedance2 资源类型">{tabs.map((tab) => <button key={tab.id} id={`seedance-tab-${tab.id}`} type="button" role="tab" aria-selected={resourceTab === tab.id} aria-controls={`seedance-resource-${tab.id}`} tabIndex={resourceTab === tab.id ? 0 : -1} onClick={() => setResourceTab(tab.id)} onKeyDown={(event) => tabKeyDown(event, tab.id)}>{tab.label}</button>)}</div>
    <div role="tabpanel" id={`seedance-resource-${resourceTab}`} aria-labelledby={`seedance-tab-${resourceTab}`}>
      {resourceTab === 'templates' && <><button type="button" className="s2-btn s2-btn-primary" onClick={() => request({ type: 'new' })}>+ 新建</button>{templates.map((item) => <button type="button" className="s2-list-item" data-active={item.id === currentId} key={item.id} onClick={() => request({ type: 'load', template: item })}>{item.title}</button>)}</>}
      {resourceTab === 'presets' && presets.map((preset) => <div className="s2-preset-item" key={preset.id}><button type="button" disabled={!shotsSection} onClick={() => shotsSection && updateSection(shotsSection.id, (section) => section.kind === 'shots' ? { ...section, segments: [...section.segments, { ...preset.segment, id: crypto.randomUUID() }] } : section)}>{preset.name}</button><button type="button" aria-label={`删除预设 ${preset.name}`} onClick={() => setDestructive({ type: 'preset', id: preset.id, name: preset.name })}>×</button></div>)}
      {resourceTab === 'references' && referenceSection?.kind === 'references' && referenceSection.refGroups.map((group, index) => <button type="button" className="s2-list-item" key={index} onClick={() => { openSection(referenceSection.id); requestAnimationFrame(() => document.getElementById(`seedance-ref-group-${referenceSection.id}-${index}`)?.querySelector<HTMLElement>('input')?.focus()) }}>{group.title || `参考分组 ${index + 1}`}</button>)}
    </div>
  </aside>

  const main = <main className="s2-main" aria-label="Seedance2 编辑器">
    <div className="s2-toolbar"><label><span className="sr-only">模板标题</span><input className="s2-input s2-title-input" value={title} onChange={(event) => { revision.current++; setTitle(event.target.value); setDirty(true) }} /></label><button className="s2-btn s2-btn-primary" disabled={saving || (!dirty && !!currentId)} onClick={() => void save()}>{saving ? '保存中…' : currentId ? '保存' : '保存为新模板'}</button>{currentId && <button className="s2-btn" disabled={saving} onClick={() => dirty ? request({ type: 'delete' }) : setDestructive({ type: 'template', id: currentId, name: title })}>删除</button>}{saveError && !pending && <span role="alert">{saveError}</span>}</div>
    <nav className="s2-section-nav" aria-label="编辑器分区">{draft.sections.map((section) => <button key={section.id} type="button" aria-current={activeSectionId === section.id ? 'true' : undefined} onClick={() => openSection(section.id)}>{section.title || '未命名类目'}</button>)}<div className="s2-add-menu"><button type="button" className="s2-add-section" aria-haspopup="menu" aria-expanded={isAddMenuOpen} onClick={() => setAddMenuOpen((open) => !open)}>新增类目</button>{isAddMenuOpen && <div className="s2-add-menu-list" role="menu">{addableSectionLabels.map((option) => <button key={option.kind} type="button" role="menuitem" disabled={defaultSectionExists(option.kind)} onClick={() => addSection(option.kind)}>{option.label}</button>)}</div>}</div></nav>
    <div className="s2-editor-scroll">{draft.sections.map(renderSection)}</div>
  </main>
  const detail = <SeedancePreviewPanel preview={preview} copyStatus={copyStatus} onCopy={() => void copyPreview()} />

  return <><WorkspaceLayout resource={resource} resourceLabel="Seedance2 资源" main={main} detail={detail} detailLabel="实时预览" />{pending && <UnsavedChangesDialog saving={saving} error={saveError} onSave={() => void saveAndContinue()} onDiscard={() => perform(pending)} onCancel={() => { setPending(null); setSaveError(null) }} />}{destructive && <DestructiveConfirmationDialog kind={destructive.type === 'template' ? '模板' : destructive.type === 'preset' ? '预设' : '类目'} name={destructive.name} pending={deleting} error={deleteError} onCancel={() => { setDestructive(null); setDeleteError(null) }} onConfirm={() => void executeDestructive()} />}{presetDraft && <PresetSaveDialog name={presetDraft.name} pending={presetSaving} error={presetError} onNameChange={(name) => setPresetDraft((value) => value ? { ...value, name } : value)} onCancel={() => { setPresetDraft(null); setPresetError(null) }} onSave={() => void savePreset()} />}</>
}
