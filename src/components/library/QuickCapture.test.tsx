import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PromptRecord } from '../../shared/types'
import { usePromptStore } from '../../stores/promptStore'
import { QuickCapture } from './QuickCapture'

function makePrompt(overrides: Partial<PromptRecord>): PromptRecord {
  return {
    id: overrides.id ?? 'prompt',
    title: overrides.title ?? '示例',
    content: overrides.content ?? 'sample content',
    notes: overrides.notes ?? '',
    tags: overrides.tags ?? [],
    params: {},
    isFavorite: false,
    lastUsedAt: null,
    lastGeneratedAt: null,
    useCount: 0,
    createdAt: '2026-04-18T00:00:00Z',
    updatedAt: '2026-04-18T00:00:00Z'
  }
}

describe('QuickCapture tag entry', () => {
  beforeEach(() => {
    usePromptStore.setState({
      prompts: [
        makePrompt({ id: 'a', tags: ['绘图', '风景', '常用'] }),
        makePrompt({ id: 'b', tags: ['绘图', '风景', '人物'] }),
        makePrompt({ id: 'c', tags: ['LLM', '人物'] })
      ]
    })
  })

  it('expands on focus or content and collapses after empty blur', async () => {
    const user = userEvent.setup()
    render(<QuickCapture />)

    const capture = screen.getByLabelText('快速录入')
    const panel = capture.closest('form')
    expect(panel).toHaveAttribute('data-expanded', 'false')

    await user.click(capture)
    expect(panel).toHaveAttribute('data-expanded', 'true')

    await user.type(capture, '两行\n内容')
    fireEvent.blur(capture)
    expect(panel).toHaveAttribute('data-expanded', 'true')

    await user.clear(capture)
    fireEvent.blur(capture)
    expect(panel).toHaveAttribute('data-expanded', 'false')
  })

  it('saves with Ctrl+Enter and keeps recognition available when expanded', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockResolvedValue(makePrompt({ id: 'new' }))
    window.promptHub.prompts.create = create
    render(<QuickCapture />)

    const capture = screen.getByLabelText('快速录入')
    await user.click(capture)
    expect(screen.getByRole('button', { name: '识图' })).toBeInTheDocument()
    await user.type(capture, '快捷保存{Control>}{Enter}{/Control}')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ content: '快捷保存' }))
  })

  it('passes typed tags to createPrompt on save', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockResolvedValue(makePrompt({ id: 'new' }))
    window.promptHub.prompts.create = create

    render(<QuickCapture />)

    await user.type(screen.getByLabelText('快速录入'), '一张赛博朋克街景')

    // Activate the 绘图 type chip via the dedicated button.
    await user.click(screen.getByRole('button', { name: '绘图' }))

    const tagInput = screen.getByLabelText('添加标签')
    await user.type(tagInput, '人物{Enter}写实,')

    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '一张赛博朋克街景',
        tags: ['绘图', '人物', '写实']
      })
    )
  })

  it('makes 绘图 / LLM type chips mutually exclusive', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockResolvedValue(makePrompt({ id: 'new' }))
    window.promptHub.prompts.create = create

    render(<QuickCapture />)

    await user.type(screen.getByLabelText('快速录入'), 'something')
    await user.click(screen.getByRole('button', { name: '绘图' }))
    await user.click(screen.getByRole('button', { name: 'LLM' }))

    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['LLM'] })
    )
  })

  it('removes the most recent user tag with backspace on an empty input', async () => {
    const user = userEvent.setup()
    render(<QuickCapture />)

    const tagInput = screen.getByLabelText('添加标签')
    await user.type(tagInput, '油画{Enter}水彩{Enter}')

    expect(screen.getByText('油画')).toBeInTheDocument()
    expect(screen.getByText('水彩')).toBeInTheDocument()

    await user.type(tagInput, '{Backspace}')
    expect(screen.queryByText('水彩')).not.toBeInTheDocument()
    expect(screen.getByText('油画')).toBeInTheDocument()
  })

  it('shows existing user tags ranked by usage (excluding type tags)', async () => {
    const user = userEvent.setup()
    render(<QuickCapture />)

    const suggestionButtons = screen
      .getAllByRole('button')
      .filter((button) => button.className.includes('capture-suggestion'))
    const suggestionLabels = suggestionButtons.map((button) => button.textContent)

    // Tags with count=2 (风景, 人物) come before count=1 (常用); among count=2,
    // pinyin sorts 风景(f) before 人物(r). Type tags 绘图/LLM are excluded
    // from the suggestion row since they live in the dedicated type chips.
    expect(suggestionLabels).toEqual(['风景', '人物', '常用'])

    await user.click(screen.getByRole('button', { name: '添加已有标签 风景' }))

    expect(screen.getByText('风景')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '添加已有标签 风景' })
    ).not.toBeInTheDocument()
  })

  it('flushes a pending tag from the input when saving', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockResolvedValue(makePrompt({ id: 'new' }))
    window.promptHub.prompts.create = create

    render(<QuickCapture />)

    await user.type(screen.getByLabelText('快速录入'), 'hello')
    await user.type(screen.getByLabelText('添加标签'), '抽象')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['抽象'] })
    )
  })
})
