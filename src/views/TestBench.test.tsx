import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PromptRecord } from '../shared/types'
import { TestBench } from './TestBench'

const imagePrompts: PromptRecord[] = [
  {
    id: 'image-1',
    title: '赛博朋克街景',
    content: 'cyberpunk street scene',
    notes: '',
    tags: ['绘图', '风景'],
    params: {},
    isFavorite: false,
    lastUsedAt: null,
    lastGeneratedAt: null,
    useCount: 0,
    createdAt: '2026-04-18T00:00:00Z',
    updatedAt: '2026-04-18T00:00:00Z'
  },
  {
    id: 'image-2',
    title: '水彩花卉',
    content: 'watercolor floral illustration',
    notes: '',
    tags: ['绘图', '插画'],
    params: {},
    isFavorite: false,
    lastUsedAt: null,
    lastGeneratedAt: null,
    useCount: 0,
    createdAt: '2026-04-18T00:00:00Z',
    updatedAt: '2026-04-18T00:00:00Z'
  }
]

describe('TestBench', () => {
  it('uses named workspace regions and switches the shared canvas between results and history', async () => {
    const user = userEvent.setup()
    window.promptHub.prompts.list = vi.fn().mockResolvedValue(imagePrompts)

    render(<TestBench />)

    expect(await screen.findByRole('region', { name: '绘图提示词' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: '生成结果' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '生成参数' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '本轮结果' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('历史生成')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '历史记录' }))
    expect(screen.getByRole('tab', { name: '历史记录' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('历史生成')).toBeInTheDocument()
    expect(screen.queryByText('点击「生成」后图像会出现在这里')).not.toBeInTheDocument()
  })

  it('keeps successful results visible when a later generation fails and retries', async () => {
    const user = userEvent.setup()
    window.promptHub.prompts.list = vi.fn().mockResolvedValue(imagePrompts)
    window.promptHub.generations.create = vi.fn().mockResolvedValue(null)
    window.promptHub.prompts.update = vi.fn().mockImplementation(async (id, patch) => ({ ...imagePrompts.find((prompt) => prompt.id === id)!, ...patch }))

    render(<TestBench />)
    await screen.findByText('赛博朋克街景')
    await user.click(screen.getByRole('button', { name: '生成' }))
    expect(await screen.findAllByAltText('赛博朋克街景')).toHaveLength(3)

    window.promptHub.generations.create = vi.fn().mockRejectedValue(new Error('write failed'))
    await user.click(screen.getByRole('button', { name: '生成' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('write failed')
    expect(screen.getAllByAltText('赛博朋克街景')).toHaveLength(3)
    await user.click(screen.getByRole('button', { name: '重试生成' }))
    expect(window.promptHub.generations.create).toHaveBeenCalled()
  })
  it('loads an image prompt into the workbench and shows generated mock results', async () => {
    const user = userEvent.setup()

    window.promptHub.prompts.list = vi.fn().mockResolvedValue(imagePrompts)
    window.promptHub.prompts.update = vi.fn().mockImplementation(async (id, patch) => {
      const current = imagePrompts.find((prompt) => prompt.id === id)

      return {
        ...current!,
        ...patch
      }
    })
    window.promptHub.generations.create = vi.fn().mockResolvedValue(null)

    render(<TestBench />)

    await user.click(await screen.findByText('赛博朋克街景'))
    await user.click(screen.getByRole('button', { name: '生成' }))

    // Mock provider returns 3 placeholder images at default params; each is
    // rendered as an <img alt={promptTitleSnapshot}> in the GenerationGrid.
    const images = await screen.findAllByAltText('赛博朋克街景')
    expect(images).toHaveLength(3)
    images.forEach((img) => {
      expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
    })
  })

  it('recovers the generate button when saving generation history fails', async () => {
    const user = userEvent.setup()

    window.promptHub.prompts.list = vi.fn().mockResolvedValue(imagePrompts)
    window.promptHub.generations.create = vi.fn().mockRejectedValue(new Error('write failed'))

    render(<TestBench />)

    await user.click(await screen.findByText('赛博朋克街景'))
    await user.click(screen.getByRole('button', { name: '生成' }))

    expect(await screen.findByRole('button', { name: '生成' })).toBeInTheDocument()
  })

  it('saves draft edits back to the selected prompt', async () => {
    const user = userEvent.setup()

    window.promptHub.prompts.list = vi.fn().mockResolvedValue(imagePrompts)
    window.promptHub.prompts.update = vi.fn().mockImplementation(async (id, patch) => {
      const current = imagePrompts.find((prompt) => prompt.id === id)

      return {
        ...current!,
        ...patch
      }
    })

    render(<TestBench />)

    const contentInput = await screen.findByDisplayValue('cyberpunk street scene')
    await user.clear(contentInput)
    await user.type(contentInput, 'cyberpunk street scene updated')

    await user.click(screen.getByRole('button', { name: '保存回提示词库' }))

    expect(window.promptHub.prompts.update).toHaveBeenCalledWith(
      'image-1',
      expect.objectContaining({
        content: 'cyberpunk street scene updated'
      })
    )
    expect(await screen.findByText('已同步到提示词库')).toBeInTheDocument()
  })

  it('restores a generation snapshot into the workbench draft', async () => {
    const user = userEvent.setup()

    window.promptHub.prompts.list = vi.fn().mockResolvedValue([imagePrompts[0]])
    window.promptHub.generations.list = vi.fn().mockResolvedValue([
      {
        id: 'history-1',
        promptId: 'image-1',
        providerId: 'mock-image',
        status: 'mocked',
        promptTitleSnapshot: '赛博朋克街景',
        promptSnapshot: 'restored prompt snapshot',
        imageData: '生成结果 1',
        params: {},
        createdAt: '2026-04-19T08:20:00.000Z'
      }
    ])

    render(<TestBench />)

    await user.click(await screen.findByRole('tab', { name: '历史记录' }))
    await user.click(await screen.findByRole('button', { name: '恢复历史：赛博朋克街景' }))

    expect(screen.getByDisplayValue('restored prompt snapshot')).toBeInTheDocument()
  })

  it('shows deleted-source history as restorable content', async () => {
    const user = userEvent.setup()

    window.promptHub.prompts.list = vi.fn().mockResolvedValue([])
    window.promptHub.generations.list = vi.fn().mockResolvedValue([
      {
        id: 'orphaned-1',
        promptId: 'missing-prompt',
        providerId: 'mock-image',
        status: 'mocked',
        promptTitleSnapshot: '已删除的提示词',
        promptSnapshot: 'abandoned ruins',
        imageData: '生成结果 1',
        params: {},
        createdAt: '2026-04-19T08:25:00.000Z'
      }
    ])

    render(<TestBench />)

    await user.click(await screen.findByRole('tab', { name: '历史记录' }))
    expect(await screen.findByText('原提示词已删除')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '恢复历史：已删除的提示词' }))
    expect(screen.getByDisplayValue('abandoned ruins')).toBeInTheDocument()
  })
})
