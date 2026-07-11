import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import App from './App'
import type { PromptRecord } from './shared/types'

const prompts: PromptRecord[] = [
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

describe('App shell', () => {
  it('renders four global navigation buttons and marks the current view', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('button', { name: '提示词库' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: '测试台' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seedance2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '提示词库', level: 1 })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '设置' }))
    expect(screen.getByRole('button', { name: '设置' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: '设置', level: 1 })).toBeInTheDocument()
  })

  it('opens the selected image prompt in the test bench from the library editor', async () => {
    const user = userEvent.setup()

    window.promptHub.prompts.list = vi.fn().mockResolvedValue(prompts)
    window.promptHub.prompts.update = vi.fn().mockImplementation(async (id, patch) => {
      const current = prompts.find((prompt) => prompt.id === id)

      return {
        ...current!,
        ...patch
      }
    })

    render(<App />)

    // Cards no longer render their title row — find by accessible name (the card's aria-label is the title).
    await user.click(await screen.findByRole('button', { name: '水彩花卉' }))
    await user.click(screen.getByRole('button', { name: '发送到测试台' }))

    expect(await screen.findByText('选择提示词')).toBeInTheDocument()
    expect(screen.getByDisplayValue('watercolor floral illustration')).toBeInTheDocument()
  })
})
