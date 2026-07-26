import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PromptRecord } from '../shared/types'
import { usePromptStore } from '../stores/promptStore'
import { Library } from './Library'

const prompts: PromptRecord[] = [
  {
    id: 'image-1',
    title: '赛博朋克街景',
    content: 'cyberpunk street scene',
    notes: '',
    tags: ['绘图', '常用', '风景'],
    params: {},
    isFavorite: true,
    lastUsedAt: '2026-04-19T08:00:00.000Z',
    lastGeneratedAt: '2026-04-19T08:10:00.000Z',
    useCount: 4,
    createdAt: '2026-04-18T00:00:00Z',
    updatedAt: '2026-04-18T00:00:00Z'
  },
  {
    id: 'llm-1',
    title: '代码审查助手',
    content: '你是一位资深代码审查专家',
    notes: '',
    tags: ['LLM', '代码'],
    params: {},
    isFavorite: false,
    lastUsedAt: null,
    lastGeneratedAt: null,
    useCount: 0,
    createdAt: '2026-04-18T00:00:00Z',
    updatedAt: '2026-04-18T00:00:00Z'
  }
]

describe('Library', () => {
  beforeEach(() => {
    usePromptStore.setState({
      filterTag: null,
      sortMode: 'default',
      search: '',
      selectedPromptId: null
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('1320'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    })
    Object.defineProperty(window, 'promptHub', {
      configurable: true,
      value: {
        prompts: {
          list: vi.fn().mockResolvedValue(prompts),
          listPage: vi.fn().mockImplementation(async (filter = {}) => {
            let items = [...prompts]
            if (filter.tag) items = items.filter((prompt) => prompt.tags.includes(filter.tag))
            if (filter.search?.trim()) {
              const search = filter.search.trim().toLowerCase()
              items = items.filter((prompt) =>
                [prompt.title, prompt.content, ...prompt.tags].some((value) =>
                  value.toLowerCase().includes(search)
                )
              )
            }
            if (filter.sort === 'favorites') items = items.filter((prompt) => prompt.isFavorite)
            return { items, total: items.length, hasMore: false }
          }),
          get: vi
            .fn()
            .mockImplementation(async (id) => prompts.find((prompt) => prompt.id === id) ?? null),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn()
        },
        settings: {
          list: vi.fn(),
          set: vi.fn()
        },
        secure: {
          has: vi.fn(),
          set: vi.fn(),
          delete: vi.fn()
        },
        ai: {
          optimize: vi.fn().mockResolvedValue(''),
          describeImage: vi.fn().mockResolvedValue('')
        },
        system: {
          clipboardImport: vi.fn(),
          openMainWindow: vi.fn(),
          setLaunchAtLogin: vi.fn(),
          quitApp: vi.fn(),
          getFloatingState: vi.fn().mockResolvedValue({
            x: 960,
            y: 320,
            side: 'right',
            expanded: false
          }),
          setFloatingExpanded: vi.fn().mockResolvedValue({
            x: 960,
            y: 320,
            side: 'right',
            expanded: false
          }),
          moveFloatingWindow: vi.fn().mockResolvedValue({
            x: 960,
            y: 320,
            side: 'right',
            expanded: false
          }),
          floatingDragStart: vi.fn().mockResolvedValue(undefined),
          floatingDragEnd: vi.fn().mockResolvedValue({
            x: 960,
            y: 320,
            side: 'right',
            expanded: false
          }),
          showFloatingContextMenu: vi.fn().mockResolvedValue(undefined)
        }
      }
    })
  })

  it('filters prompt cards by tag', async () => {
    const user = userEvent.setup()

    render(<Library />)

    expect(await screen.findByRole('button', { name: '赛博朋克街景' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '代码审查助手' })).toBeInTheDocument()
    expect(screen.getByText('赛博朋克街景', { selector: '.prompt-card-title' })).toBeVisible()
    expect(screen.getByText('代码审查助手', { selector: '.prompt-card-title' })).toBeVisible()

    // The LibraryFilters tag bar exposes its chips as role="tab".
    await user.click(screen.getByRole('tab', { name: 'LLM' }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '赛博朋克街景' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '代码审查助手' })).toBeInTheDocument()
    })
  })

  it('uses named resource, main, and detail workspace regions', async () => {
    render(<Library />)
    expect(await screen.findByRole('region', { name: '提示词筛选' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: '提示词工作区' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '提示词详情' })).toBeInTheDocument()
    expect(screen.getByLabelText('快速录入')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: '提示词详情' }).querySelector('.library-detail')
    ).toHaveAttribute('data-compact', 'true')
  })

  it('searches, sorts, and repairs selection when the result changes', async () => {
    const user = userEvent.setup()
    render(<Library />)
    const first = await screen.findByRole('button', { name: '赛博朋克街景' })
    await user.click(first)
    await user.type(screen.getByLabelText('搜索提示词'), '代码')
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '赛博朋克街景' })).not.toBeInTheDocument()
    )
    expect(screen.getByLabelText('提示词内容')).toHaveValue('你是一位资深代码审查专家')
    await user.clear(screen.getByLabelText('搜索提示词'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '赛博朋克街景' })).toBeInTheDocument()
    )
    await user.selectOptions(screen.getByRole('combobox', { name: '排序方式' }), 'recent-used')
    const cards = screen
      .getAllByRole('button')
      .filter((button) =>
        ['赛博朋克街景', '代码审查助手'].includes(button.getAttribute('aria-label') ?? '')
      )
    expect(cards[0]).toHaveAttribute('aria-label', '赛博朋克街景')
  })

  it('shows only favorite prompts when favorite mode is selected', async () => {
    const user = userEvent.setup()

    render(<Library />)

    expect(await screen.findByRole('button', { name: '赛博朋克街景' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '代码审查助手' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '已收藏' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '赛博朋克街景' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '代码审查助手' })).not.toBeInTheDocument()
    })
  })

  it('exposes active shortcut views with aria-pressed', async () => {
    const user = userEvent.setup()
    render(<Library />)
    await screen.findByRole('button', { name: '赛博朋克街景' })
    const favorites = screen.getByRole('button', { name: '已收藏' })
    const recent = screen.getByRole('button', { name: '最近使用' })
    expect(favorites).toHaveAttribute('aria-pressed', 'false')
    await user.click(recent)
    expect(recent).toHaveAttribute('aria-pressed', 'true')
  })
})
