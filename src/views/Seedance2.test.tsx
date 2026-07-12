import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Seedance2TemplateRecord } from '../shared/types'
import { useAppStore } from '../stores/appStore'
import { Seedance2 } from './Seedance2'

const data = (intro = 'intro') => ({ intro, refGroups: [], segments: [], segmentsFooter: '', style: 'style' })
const templates: Seedance2TemplateRecord[] = [
  { id: 'one', title: 'One', data: data('one'), createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'two', title: 'Two', data: data('two'), createdAt: '2026-01-01', updatedAt: '2026-01-01' }
]

function seedApi() {
  const api = window.promptHub.seedance2
  vi.mocked(api.listTemplates).mockResolvedValue(templates)
  vi.mocked(api.listPresets).mockResolvedValue([])
  vi.mocked(api.updateTemplate).mockResolvedValue(templates[0])
  return api
}

describe('Seedance2 workspace', () => {
  it('adds a named custom section and deletes an empty one without confirmation', async () => {
    seedApi(); render(<Seedance2 />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '新增类目' }))
    const title = screen.getByLabelText('类目标题 新类目')
    await user.clear(title)
    await user.type(title, '角色设定')
    expect(screen.getByRole('button', { name: '角色设定', expanded: true })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '删除类目 角色设定' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '角色设定' })).not.toBeInTheDocument()
  })

  it('confirms before deleting a non-empty custom section', async () => {
    seedApi(); render(<Seedance2 />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '新增类目' }))
    await user.type(screen.getByLabelText('新类目内容'), '角色设定内容')
    await user.click(screen.getByRole('button', { name: '删除类目 新类目' }))

    expect(screen.getByRole('dialog', { name: '删除类目' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    expect(screen.queryByRole('button', { name: '新类目' })).not.toBeInTheDocument()
  })

  it('uses one workspace layout and accessible accordions', async () => {
    seedApi(); render(<Seedance2 />)
    expect(await screen.findByRole('complementary', { name: 'Seedance2 资源' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: 'Seedance2 编辑器' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '实时预览' })).toBeInTheDocument()
    const intro = screen.getByRole('button', { name: '开篇总述', expanded: true })
    expect(intro).toHaveAttribute('aria-expanded', 'true')
    expect(intro).toHaveAttribute('aria-controls', 'seedance-section-intro')
  })

  it('exposes real resource tabs and opens a referenced group in the editor', async () => {
    const withRefs = [{ ...templates[0], data: { ...templates[0].data, refGroups: [{ title: '主角参考', description: '', items: [] }] } }]
    const api = seedApi(); vi.mocked(api.listTemplates).mockResolvedValue(withRefs)
    render(<Seedance2 />); const user = userEvent.setup()
    const templateTab = screen.getByRole('tab', { name: '模板' })
    const presetTab = screen.getByRole('tab', { name: '预设' })
    const referenceTab = screen.getByRole('tab', { name: '参考' })
    expect(templateTab).toHaveAttribute('aria-controls', 'seedance-resource-templates')
    expect(templateTab).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'seedance-resource-templates')
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.click(presetTab)
    expect(presetTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'seedance-resource-presets')
    await user.click(referenceTab)
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'seedance-resource-references')
    await user.click(screen.getByRole('button', { name: '主角参考' }))
    expect(screen.getByRole('button', { name: '参考资料', expanded: true })).toBeInTheDocument()
  })

  it('collapses an expanded section deliberately even when content had focus', async () => {
    seedApi(); render(<Seedance2 />); const user = userEvent.setup()
    const intro = screen.getByRole('button', { name: '开篇总述', expanded: true })
    await user.click(intro)
    expect(intro).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('seedance-section-intro')).toHaveAttribute('hidden')
    await user.click(screen.getByRole('button', { name: '风格', expanded: false }))
    const style = screen.getByRole('button', { name: '风格', expanded: true })
    expect(style).toHaveAttribute('aria-controls', 'seedance-section-style')
    const textarea = screen.getByLabelText('风格内容')
    textarea.focus()
    await user.click(style)
    expect(style).toHaveAttribute('aria-expanded', 'false')
  })

  it('confirms clean template deletion without a native confirm', async () => {
    const api = seedApi(); vi.mocked(api.deleteTemplate).mockResolvedValue(undefined)
    render(<Seedance2 />); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.getByRole('dialog', { name: '删除模板' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    await waitFor(() => expect(api.deleteTemplate).toHaveBeenCalledWith('one'))
    expect(api.listTemplates).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('模板标题')).toHaveValue('未命名模板')
  })

  it('requires destructive confirmation after discarding a dirty delete', async () => {
    const api = seedApi(); vi.mocked(api.deleteTemplate).mockResolvedValue(undefined)
    render(<Seedance2 />); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.type(screen.getByLabelText('开篇总述内容'), '!')
    await user.click(screen.getByRole('button', { name: '删除' }))
    await user.click(screen.getByRole('button', { name: '放弃更改' }))
    expect(api.deleteTemplate).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: '删除模板' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    await waitFor(() => expect(api.deleteTemplate).toHaveBeenCalledWith('one'))
  })

  it('requires destructive confirmation after saving a dirty delete', async () => {
    const api = seedApi(); vi.mocked(api.deleteTemplate).mockResolvedValue(undefined)
    render(<Seedance2 />); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.type(screen.getByLabelText('开篇总述内容'), '!')
    await user.click(screen.getByRole('button', { name: '删除' }))
    await user.click(screen.getByRole('button', { name: '保存并继续' }))
    expect(await screen.findByRole('dialog', { name: '删除模板' })).toBeInTheDocument()
    expect(api.updateTemplate).toHaveBeenCalledOnce()
    expect(api.deleteTemplate).not.toHaveBeenCalled()
  })

  it('prevents duplicate create and keeps newer edits dirty when save resolves', async () => {
    const api = seedApi()
    let resolve!: (value: Seedance2TemplateRecord) => void
    vi.mocked(api.createTemplate).mockImplementation(() => new Promise((done) => { resolve = done }))
    render(<Seedance2 />); const user = userEvent.setup()
    const intro = screen.getByLabelText('开篇总述内容')
    await user.type(intro, '!')
    const save = screen.getByRole('button', { name: '保存为新模板' })
    await user.click(save)
    expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '保存中…' }))
    expect(api.createTemplate).toHaveBeenCalledTimes(1)
    await user.type(intro, ' newer')
    resolve({ ...templates[0], data: data('saved') })
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled())
    expect((intro as HTMLTextAreaElement).value).toContain('newer')
  })

  it('shows clipboard failures instead of leaking an unhandled rejection', async () => {
    seedApi(); vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('clipboard denied'))
    render(<Seedance2 />); const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '复制' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('clipboard denied')
  })

  it('retains preset name and exact segment while a failed save is retried', async () => {
    const segment = { id: 'shot-1', timeLabel: '0-3s', shotType: 'Close', description: 'desc', dialog: '' }
    const api = seedApi()
    vi.mocked(api.listTemplates).mockResolvedValue([{ ...templates[0], data: { ...templates[0].data, segments: [segment] } }])
    vi.mocked(api.createPreset).mockRejectedValueOnce(new Error('preset offline')).mockResolvedValueOnce({ id: 'preset-1', name: 'Hero shot', segment, tags: [], createdAt: 'now', updatedAt: 'now' })
    render(<Seedance2 />); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.click(screen.getByRole('button', { name: '镜头序列', expanded: false }))
    await user.click(screen.getByTitle('存为片段预设'))
    const name = screen.getByRole('textbox', { name: '预设名称' })
    await user.clear(name); await user.type(name, 'Hero shot')
    await user.click(screen.getByRole('button', { name: '保存预设' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('preset offline')
    expect(name).toHaveValue('Hero shot')
    await user.click(screen.getByRole('button', { name: '保存预设' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '保存镜头预设' })).not.toBeInTheDocument())
    expect(api.createPreset).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'Hero shot', segment: expect.objectContaining({ timeLabel: '0-3s', description: 'desc' }) }))
    expect(api.createPreset).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: 'Hero shot', segment: expect.objectContaining({ timeLabel: '0-3s', description: 'desc' }) }))
  })

  it('retries only preset reload when creation already succeeded', async () => {
    const segment = { id: 'shot-1', timeLabel: '0-3s', shotType: 'Close', description: 'desc', dialog: '' }
    const api = seedApi()
    vi.mocked(api.listTemplates).mockResolvedValue([{ ...templates[0], data: { ...templates[0].data, segments: [segment] } }])
    vi.mocked(api.createPreset).mockResolvedValue({ id: 'preset-1', name: 'Close', segment, tags: [], createdAt: 'now', updatedAt: 'now' })
    vi.mocked(api.listPresets).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('reload failed')).mockResolvedValueOnce([])
    render(<Seedance2 />); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.click(screen.getByRole('button', { name: '镜头序列', expanded: false }))
    await user.click(screen.getByTitle('存为片段预设'))
    await user.click(screen.getByRole('button', { name: '保存预设' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('reload failed')
    await user.click(screen.getByRole('button', { name: '保存预设' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '保存镜头预设' })).not.toBeInTheDocument())
    expect(api.createPreset).toHaveBeenCalledTimes(1)
    expect(api.listPresets).toHaveBeenCalledTimes(3)
  })

  it('guards a dirty template switch and cancel retains the draft', async () => {
    seedApi(); render(<Seedance2 />); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.type(screen.getByLabelText('开篇总述内容'), ' changed')
    await user.click(screen.getByRole('button', { name: 'Two' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存并继续' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '放弃更改' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.getByLabelText('开篇总述内容')).toHaveValue('one changed')
  })

  it('discards or saves before continuing and preserves failure for retry', async () => {
    const api = seedApi(); render(<Seedance2 />); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.type(screen.getByLabelText('开篇总述内容'), '!')
    await user.click(screen.getByRole('button', { name: 'Two' }))
    await user.click(screen.getByRole('button', { name: '放弃更改' }))
    expect(screen.getByLabelText('开篇总述内容')).toHaveValue('two')

    await user.type(screen.getByLabelText('开篇总述内容'), '!')
    await user.click(screen.getByRole('button', { name: 'One' }))
    vi.mocked(api.updateTemplate).mockRejectedValueOnce(new Error('network down'))
    await user.click(screen.getByRole('button', { name: '保存并继续' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('network down')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    vi.mocked(api.updateTemplate).mockResolvedValueOnce(templates[1])
    await user.click(screen.getByRole('button', { name: '保存并继续' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.updateTemplate).toHaveBeenCalledTimes(2)
  })

  it('guards global navigation while dirty but navigates immediately when clean', async () => {
    seedApi(); render(<Seedance2 />); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    act(() => useAppStore.getState().setCurrentView('settings'))
    expect(useAppStore.getState().currentView).toBe('settings')
    act(() => useAppStore.getState().setCurrentView('seedance2'))
    await user.type(screen.getByLabelText('开篇总述内容'), '!')
    act(() => useAppStore.getState().setCurrentView('settings'))
    expect(useAppStore.getState().currentView).toBe('seedance2')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('preserves test-bench navigation payload and ignores same-view navigation', async () => {
    seedApi(); useAppStore.getState().continueNavigation({ view: 'seedance2', pendingTestBenchPromptId: null })
    render(<Seedance2 />); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.type(screen.getByLabelText('开篇总述内容'), '!')
    act(() => useAppStore.getState().setCurrentView('seedance2'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => useAppStore.getState().openTestBench('prompt-42'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '放弃更改' }))
    expect(useAppStore.getState().currentView).toBe('test-bench')
    expect(useAppStore.getState().pendingTestBenchPromptId).toBe('prompt-42')
  })
})
