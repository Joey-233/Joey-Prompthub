import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Seedance2TemplateRecord } from '../shared/types'
import { useAppStore } from '../stores/appStore'
import { Seedance2 } from './Seedance2'

const data = (intro = 'intro') => ({
  intro,
  refGroups: [],
  segments: [],
  segmentsFooter: '',
  style: 'style'
})
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
  it('loads the saved default template and marks it in both template surfaces', async () => {
    seedApi()
    vi.mocked(window.promptHub.settings.list).mockResolvedValue({
      seedance2_default_template_id: 'two'
    })

    render(<Seedance2 />)

    expect(await screen.findByLabelText('模板标题')).toHaveValue('Two')
    expect(screen.getByLabelText('开篇总述内容')).toHaveValue('two')
    expect(screen.getByRole('button', { name: '默认模板' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Two' })).toHaveAttribute('data-default', 'true')
    expect(screen.getByText('默认', { selector: '.s2-default-badge' })).toBeVisible()
  })

  it('sets a saved custom template as the default', async () => {
    seedApi()
    render(<Seedance2 />)
    const user = userEvent.setup()

    expect(screen.getByRole('button', { name: '设为默认' })).toBeDisabled()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.click(screen.getByRole('button', { name: '设为默认' }))

    await waitFor(() =>
      expect(window.promptHub.settings.set).toHaveBeenCalledWith(
        'seedance2_default_template_id',
        'one'
      )
    )
    expect(screen.getByRole('button', { name: '默认模板' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('data-default', 'true')
  })

  it('requires saving template changes before setting the template as default', async () => {
    seedApi()
    render(<Seedance2 />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.type(screen.getByLabelText('开篇总述内容'), ' changed')

    expect(screen.getByRole('button', { name: '设为默认' })).toBeDisabled()
    expect(window.promptHub.settings.set).not.toHaveBeenCalled()
  })

  it('clears the default setting when the default template is deleted', async () => {
    const api = seedApi()
    vi.mocked(api.deleteTemplate).mockResolvedValue(undefined)
    vi.mocked(window.promptHub.settings.list).mockResolvedValue({
      seedance2_default_template_id: 'two'
    })
    render(<Seedance2 />)
    const user = userEvent.setup()

    expect(await screen.findByLabelText('模板标题')).toHaveValue('Two')
    await user.click(screen.getByRole('button', { name: '删除' }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))

    await waitFor(() =>
      expect(window.promptHub.settings.set).toHaveBeenCalledWith(
        'seedance2_default_template_id',
        null
      )
    )
    expect(screen.getByLabelText('模板标题')).toHaveValue('未命名模板')
    expect(screen.getByRole('button', { name: '设为默认' })).toBeDisabled()
  })

  it('restores a deleted reference section as a normal text node', async () => {
    seedApi()
    render(<Seedance2 />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '新增类目' }))
    expect(screen.getByRole('menuitem', { name: '参考资料' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '新增类目' }))

    await user.click(screen.getByRole('button', { name: '删除类目 角色与素材锚定' }))
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    expect(screen.queryByRole('button', { name: '角色与素材锚定' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '新增类目' }))
    await user.click(screen.getByRole('menuitem', { name: '参考资料' }))

    expect(screen.getByRole('button', { name: '参考资料', expanded: true })).toBeInTheDocument()
    expect(screen.getByLabelText('参考资料内容')).toHaveValue('')
    expect(screen.queryByRole('button', { name: '+ 参考分组' })).not.toBeInTheDocument()
  })

  it('inserts all four material anchor snippets as separate lines at the caret', async () => {
    seedApi()
    render(<Seedance2 />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.click(screen.getByRole('button', { name: '参考资料', expanded: false }))
    const textarea = screen.getByLabelText('参考资料内容') as HTMLTextAreaElement
    await user.type(textarea, '第一行\n第三行')
    textarea.focus()
    textarea.setSelectionRange('第一行\n'.length, '第一行\n'.length)

    await user.click(screen.getByRole('button', { name: '插入角色参考' }))
    await user.click(screen.getByRole('button', { name: '插入场景参考' }))
    await user.click(screen.getByRole('button', { name: '插入道具参考' }))
    await user.click(screen.getByRole('button', { name: '插入音色参考' }))

    expect(textarea).toHaveValue(
      [
        '第一行',
        '将@###作为主角的视觉参考',
        '将@###作为场景的视觉参考',
        '将@###作为道具的视觉参考',
        '将@###作为主角的音色参考',
        '第三行'
      ].join('\n')
    )
    expect(textarea).toHaveFocus()
    expect(screen.getByText(/将@###作为主角的音色参考/, { selector: '.s2-preview' })).toBeVisible()
  })

  it('removes the legacy shot-sequence footer from the editor and preview', async () => {
    const api = seedApi()
    vi.mocked(api.listTemplates).mockResolvedValue([
      {
        ...templates[0],
        data: {
          ...templates[0].data,
          segmentsFooter: '旧版镜头序列底部说明'
        }
      }
    ])
    render(<Seedance2 />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.click(screen.getByRole('button', { name: '镜头序列', expanded: false }))

    expect(screen.queryByLabelText('镜头序列底部说明')).not.toBeInTheDocument()
    expect(screen.queryByText('旧版镜头序列底部说明')).not.toBeInTheDocument()
  })

  it('adds the voice constraint once to the active shot dialog', async () => {
    const first = {
      id: 'shot-1',
      timeLabel: '0-3s',
      shotType: '第一视角',
      description: '第一个镜头',
      dialog: '第一句台词'
    }
    const second = {
      id: 'shot-2',
      timeLabel: '3-6s',
      shotType: '近景',
      description: '第二个镜头',
      dialog: ''
    }
    const api = seedApi()
    vi.mocked(api.listTemplates).mockResolvedValue([
      {
        ...templates[0],
        data: {
          ...templates[0].data,
          segments: [first, second]
        }
      }
    ])
    render(<Seedance2 />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.click(screen.getByRole('button', { name: '镜头序列', expanded: false }))
    const constraintButton = screen.getByRole('button', { name: '+ 音色约束' })
    const dialogBoxes = screen.getAllByPlaceholderText('台词（每行一句，如 地精王："Pathetic."）')

    await user.click(constraintButton)
    expect(dialogBoxes[0]).toHaveValue('第一句台词\n（完全使用@###音色，禁止修改台词）')
    expect(dialogBoxes[1]).toHaveValue('')

    await user.click(constraintButton)
    expect(dialogBoxes[0]).toHaveValue('第一句台词\n（完全使用@###音色，禁止修改台词）')

    await user.click(dialogBoxes[1])
    await user.click(constraintButton)
    expect(dialogBoxes[1]).toHaveValue('（完全使用@###音色，禁止修改台词）')
    expect(dialogBoxes[1]).toHaveFocus()
  })

  it('adds a named custom section and deletes an empty one without confirmation', async () => {
    seedApi()
    render(<Seedance2 />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '新增类目' }))
    await user.click(screen.getByRole('menuitem', { name: '自定义文本类目' }))
    const title = screen.getByLabelText('类目标题 新类目')
    await user.clear(title)
    await user.type(title, '角色设定')
    expect(screen.getByRole('button', { name: '角色设定', expanded: true })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '删除类目 角色设定' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '角色设定' })).not.toBeInTheDocument()
  })

  it('confirms before deleting a non-empty custom section', async () => {
    seedApi()
    render(<Seedance2 />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: '新增类目' }))
    await user.click(screen.getByRole('menuitem', { name: '自定义文本类目' }))
    await user.type(screen.getByLabelText('新类目内容'), '角色设定内容')
    await user.click(screen.getByRole('button', { name: '删除类目 新类目' }))

    expect(screen.getByRole('dialog', { name: '删除类目' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    expect(screen.queryByRole('button', { name: '新类目' })).not.toBeInTheDocument()
  })

  it('uses one workspace layout and accessible accordions', async () => {
    seedApi()
    render(<Seedance2 />)
    expect(await screen.findByRole('complementary', { name: 'Seedance2 资源' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: 'Seedance2 编辑器' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '实时预览' })).toBeInTheDocument()
    const intro = screen.getByRole('button', { name: '风格设定', expanded: true })
    expect(intro).toHaveAttribute('aria-expanded', 'true')
    expect(intro).toHaveAttribute('aria-controls', 'seedance-section-intro')
  })

  it('keeps only useful resource tabs and converts legacy reference groups to text', async () => {
    const withRefs = [
      {
        ...templates[0],
        data: {
          ...templates[0].data,
          refGroups: [{ title: '主角参考', description: '', items: [] }]
        }
      }
    ]
    const api = seedApi()
    vi.mocked(api.listTemplates).mockResolvedValue(withRefs)
    render(<Seedance2 />)
    const user = userEvent.setup()
    const templateTab = screen.getByRole('tab', { name: '模板' })
    const presetTab = screen.getByRole('tab', { name: '预设' })
    expect(templateTab).toHaveAttribute('aria-controls', 'seedance-resource-templates')
    expect(templateTab).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'seedance-resource-templates')
    expect(screen.queryByRole('tab', { name: '参考' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.click(screen.getByRole('button', { name: '参考资料', expanded: false }))
    expect(screen.getByLabelText('参考资料内容')).toHaveValue('【主角参考】')
    await user.click(presetTab)
    expect(presetTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'seedance-resource-presets')
  })

  it('collapses an expanded section deliberately even when content had focus', async () => {
    seedApi()
    render(<Seedance2 />)
    const user = userEvent.setup()
    const intro = screen.getByRole('button', { name: '风格设定', expanded: true })
    await user.click(intro)
    expect(intro).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('seedance-section-intro')).toHaveAttribute('hidden')
    await user.click(screen.getByRole('button', { name: '特殊要求', expanded: false }))
    const style = screen.getByRole('button', { name: '特殊要求', expanded: true })
    expect(style).toHaveAttribute('aria-controls', 'seedance-section-style')
    const textarea = screen.getByLabelText('特殊要求内容')
    textarea.focus()
    await user.click(style)
    expect(style).toHaveAttribute('aria-expanded', 'false')
  })

  it('confirms clean template deletion without a native confirm', async () => {
    const api = seedApi()
    vi.mocked(api.deleteTemplate).mockResolvedValue(undefined)
    render(<Seedance2 />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.getByRole('dialog', { name: '删除模板' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    await waitFor(() => expect(api.deleteTemplate).toHaveBeenCalledWith('one'))
    expect(api.listTemplates).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('模板标题')).toHaveValue('未命名模板')
  })

  it('requires destructive confirmation after discarding a dirty delete', async () => {
    const api = seedApi()
    vi.mocked(api.deleteTemplate).mockResolvedValue(undefined)
    render(<Seedance2 />)
    const user = userEvent.setup()
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
    const api = seedApi()
    vi.mocked(api.deleteTemplate).mockResolvedValue(undefined)
    render(<Seedance2 />)
    const user = userEvent.setup()
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
    vi.mocked(api.createTemplate).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    render(<Seedance2 />)
    const user = userEvent.setup()
    const intro = screen.getByLabelText('风格设定内容')
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
    seedApi()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('clipboard denied'))
    render(<Seedance2 />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '复制' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('clipboard denied')
  })

  it('retains preset name and exact segment while a failed save is retried', async () => {
    const segment = {
      id: 'shot-1',
      timeLabel: '0-3s',
      shotType: 'Close',
      description: 'desc',
      dialog: ''
    }
    const api = seedApi()
    vi.mocked(api.listTemplates).mockResolvedValue([
      { ...templates[0], data: { ...templates[0].data, segments: [segment] } }
    ])
    vi.mocked(api.createPreset)
      .mockRejectedValueOnce(new Error('preset offline'))
      .mockResolvedValueOnce({
        id: 'preset-1',
        name: 'Hero shot',
        segment,
        tags: [],
        createdAt: 'now',
        updatedAt: 'now'
      })
    render(<Seedance2 />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.click(screen.getByRole('button', { name: '镜头序列', expanded: false }))
    await user.click(screen.getByTitle('存为片段预设'))
    const name = screen.getByRole('textbox', { name: '预设名称' })
    await user.clear(name)
    await user.type(name, 'Hero shot')
    await user.click(screen.getByRole('button', { name: '保存预设' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('preset offline')
    expect(name).toHaveValue('Hero shot')
    await user.click(screen.getByRole('button', { name: '保存预设' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '保存镜头预设' })).not.toBeInTheDocument()
    )
    expect(api.createPreset).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: 'Hero shot',
        segment: expect.objectContaining({ timeLabel: '0-3s', description: 'desc' })
      })
    )
    expect(api.createPreset).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: 'Hero shot',
        segment: expect.objectContaining({ timeLabel: '0-3s', description: 'desc' })
      })
    )
  })

  it('retries only preset reload when creation already succeeded', async () => {
    const segment = {
      id: 'shot-1',
      timeLabel: '0-3s',
      shotType: 'Close',
      description: 'desc',
      dialog: ''
    }
    const api = seedApi()
    vi.mocked(api.listTemplates).mockResolvedValue([
      { ...templates[0], data: { ...templates[0].data, segments: [segment] } }
    ])
    vi.mocked(api.createPreset).mockResolvedValue({
      id: 'preset-1',
      name: 'Close',
      segment,
      tags: [],
      createdAt: 'now',
      updatedAt: 'now'
    })
    vi.mocked(api.listPresets)
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('reload failed'))
      .mockResolvedValueOnce([])
    render(<Seedance2 />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.click(screen.getByRole('button', { name: '镜头序列', expanded: false }))
    await user.click(screen.getByTitle('存为片段预设'))
    await user.click(screen.getByRole('button', { name: '保存预设' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('reload failed')
    await user.click(screen.getByRole('button', { name: '保存预设' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '保存镜头预设' })).not.toBeInTheDocument()
    )
    expect(api.createPreset).toHaveBeenCalledTimes(1)
    expect(api.listPresets).toHaveBeenCalledTimes(3)
  })

  it('guards a dirty template switch and cancel retains the draft', async () => {
    seedApi()
    render(<Seedance2 />)
    const user = userEvent.setup()
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
    const api = seedApi()
    render(<Seedance2 />)
    const user = userEvent.setup()
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
    seedApi()
    render(<Seedance2 />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    act(() => useAppStore.getState().setCurrentView('settings'))
    expect(useAppStore.getState().currentView).toBe('settings')
    act(() => useAppStore.getState().setCurrentView('seedance2'))
    await user.type(screen.getByLabelText('开篇总述内容'), '!')
    act(() => useAppStore.getState().setCurrentView('settings'))
    expect(useAppStore.getState().currentView).toBe('seedance2')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('preserves guarded navigation target and ignores same-view navigation', async () => {
    seedApi()
    useAppStore.getState().continueNavigation({ view: 'seedance2' })
    render(<Seedance2 />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.type(screen.getByLabelText('开篇总述内容'), '!')
    act(() => useAppStore.getState().setCurrentView('seedance2'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => useAppStore.getState().setCurrentView('library'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '放弃更改' }))
    expect(useAppStore.getState().currentView).toBe('library')
  })
})
