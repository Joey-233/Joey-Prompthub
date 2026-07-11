import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { PromptRecord } from '../../shared/types'
import { PromptList } from './PromptList'

const prompt = (id: string, title: string, lastUsedAt: string | null, useCount = 0): PromptRecord => ({ id, title, content: title, notes: '', tags: ['绘图'], params: {}, isFavorite: false, lastUsedAt, lastGeneratedAt: null, useCount, createdAt: '2026-01-01', updatedAt: '2026-01-01' })

it('offers a recent-used filter sorted newest first while retaining the selected prompt', async () => {
  const user = userEvent.setup()
  render(<PromptList prompts={[prompt('never', 'Never', null), prompt('old', 'Old', '2026-01-02'), prompt('new', 'New', '2026-01-03')]} selectedPromptId="never" onSelect={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: '最近使用' }))
  const items = screen.getAllByRole('button').filter((button) => ['Never', 'Old', 'New'].includes(button.textContent ?? ''))
  expect(items.map((item) => item.textContent)).toEqual(['Never', 'New', 'Old'])
  expect(screen.getByRole('button', { name: '最近使用' })).toHaveAttribute('aria-pressed', 'true')
})
