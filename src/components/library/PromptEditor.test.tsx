import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

// jsdom 没有 canvas，mock 图片压缩工具
vi.mock('../../lib/imageFile', () => ({
  readImageFileAsDataUrl: vi.fn().mockResolvedValue('data:image/jpeg;base64,RESIZED')
}))

import type { PromptRecord } from '../../shared/types'
import { readImageFileAsDataUrl } from '../../lib/imageFile'
import { PromptEditor } from './PromptEditor'

afterEach(() => {
  vi.useRealTimers()
})

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

  it('uploads a preview image and saves it through the debounced draft', async () => {
    let finishImageRead!: (dataUrl: string) => void
    vi.mocked(readImageFileAsDataUrl).mockImplementationOnce(
      () => new Promise((resolve) => (finishImageRead = resolve))
    )
    const updatePrompt = vi.fn().mockResolvedValue({
      ...prompt,
      previewImage: 'data:image/jpeg;base64,RESIZED'
    })
    window.promptHub.prompts.update = updatePrompt

    render(<PromptEditor prompt={prompt} />)

    const file = new File(['img'], 'preview.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('上传预览图文件'), {
      target: { files: [file] }
    })

    await waitFor(() => {
      expect(readImageFileAsDataUrl).toHaveBeenCalledWith(file, {
        maxDimension: 512,
        quality: 0.8
      })
    })

    vi.useFakeTimers()
    await act(async () => {
      finishImageRead('data:image/jpeg;base64,RESIZED')
    })
    expect(screen.getByAltText('预览图 1')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(850) })

    expect(updatePrompt).toHaveBeenCalledWith(
      'image-1',
      expect.objectContaining({
        previewImages: ['data:image/jpeg;base64,RESIZED']
      })
    )
    await act(async () => {})
    expect(screen.getByRole('status')).toHaveTextContent('已保存')
  })

  it('shows an error and retries the latest failed patch', async () => {
    vi.useFakeTimers()
    const updatePrompt = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(prompt)
    window.promptHub.prompts.update = updatePrompt
    render(<PromptEditor prompt={prompt} />)
    fireEvent.change(screen.getByLabelText('提示词内容'), { target: { value: 'latest patch' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(850) })
    expect(screen.getByRole('status')).toHaveTextContent('保存失败')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '重试' })) })
    expect(updatePrompt).toHaveBeenLastCalledWith('image-1', expect.objectContaining({ content: 'latest patch' }))
    expect(screen.getByRole('status')).toHaveTextContent('已保存')
  })

  it('does not let a stale prompt request update the new prompt status', async () => {
    vi.useFakeTimers()
    let rejectOld!: (reason: Error) => void
    window.promptHub.prompts.update = vi.fn().mockImplementationOnce(() => new Promise((_, reject) => { rejectOld = reject }))
    const { rerender } = render(<PromptEditor prompt={prompt} />)
    fireEvent.change(screen.getByLabelText('提示词内容'), { target: { value: 'old edit' } })
    await vi.advanceTimersByTimeAsync(850)
    rerender(<PromptEditor prompt={{ ...prompt, id: 'image-2', content: 'new prompt' }} />)
    await act(async () => rejectOld(new Error('late failure')))
    expect(screen.getByRole('status')).not.toHaveTextContent('保存失败')
  })

  it('removes an existing preview image with an empty-string patch', async () => {
    vi.useFakeTimers()
    const promptWithPreview: PromptRecord = {
      ...prompt,
      previewImage: 'data:image/jpeg;base64,OLD'
    }
    const updatePrompt = vi.fn().mockResolvedValue({ ...promptWithPreview, previewImage: '' })
    window.promptHub.prompts.update = updatePrompt

    render(<PromptEditor prompt={promptWithPreview} />)

    expect(screen.getByAltText('预览图 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '移除该预览图' }))
    await vi.advanceTimersByTimeAsync(900)

    expect(updatePrompt).toHaveBeenCalledWith(
      'image-1',
      expect.objectContaining({ previewImages: [] })
    )

    vi.useRealTimers()
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
