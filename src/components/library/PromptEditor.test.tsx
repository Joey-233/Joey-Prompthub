import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PromptRecord } from '../../shared/types'
import { PromptEditor } from './PromptEditor'

const prompt: PromptRecord = {
  id: 'image-1',
  title: '赛博朋克街景',
  content: 'cyberpunk street scene',
  notes: '',
  tags: ['绘图', '常用'],
  params: {},
  isFavorite: false,
  lastUsedAt: null,
  lastGeneratedAt: null,
  useCount: 0,
  createdAt: '2026-04-18T00:00:00Z',
  updatedAt: '2026-04-18T00:00:00Z'
}

describe('PromptEditor', () => {
  it('saves content changes after a debounce delay', async () => {
    vi.useFakeTimers()
    const updatePrompt = vi.fn().mockResolvedValue({
      ...prompt,
      content: 'cyberpunk street scene updated'
    })

    window.promptHub.prompts.update = updatePrompt

    render(<PromptEditor prompt={prompt} />)

    const textarea = screen.getByLabelText('提示词内容')
    fireEvent.change(textarea, {
      target: { value: 'cyberpunk street scene updated' }
    })
    await vi.advanceTimersByTimeAsync(850)

    expect(updatePrompt).toHaveBeenCalledWith(
      'image-1',
      expect.objectContaining({
        content: 'cyberpunk street scene updated'
      })
    )

    vi.useRealTimers()
  })

  it('does not save an unchanged prompt during cleanup', () => {
    const updatePrompt = vi.fn().mockResolvedValue(prompt)

    window.promptHub.prompts.update = updatePrompt

    const { unmount } = render(<PromptEditor prompt={prompt} />)

    unmount()

    expect(updatePrompt).not.toHaveBeenCalled()
  })

  it('toggles favorite state for the selected prompt', async () => {
    const user = userEvent.setup()
    const updatePrompt = vi.fn().mockResolvedValue({
      ...prompt,
      isFavorite: true
    })

    window.promptHub.prompts.update = updatePrompt

    render(<PromptEditor prompt={prompt} />)

    await user.click(screen.getByRole('button', { name: '收藏提示词' }))

    await waitFor(() => {
      expect(updatePrompt).toHaveBeenCalledWith(
        'image-1',
        expect.objectContaining({
          isFavorite: true
        })
      )
    })
  })
})
