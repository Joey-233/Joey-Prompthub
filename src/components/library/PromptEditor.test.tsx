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
  it('keeps supporting fields mounted inside collapsed editor sections', () => {
    render(<PromptEditor prompt={prompt} />)

    expect(screen.getByLabelText('提示词内容')).toBeVisible()
    expect(screen.getByLabelText('备注')).toBeInTheDocument()
    expect(screen.getByLabelText('上传预览图文件')).toBeInTheDocument()
    expect(document.querySelectorAll('.editor-section')).toHaveLength(3)
    expect(document.querySelectorAll('.editor-section[open]')).toHaveLength(0)
  })

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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(850)
    })

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
    const updatePrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(prompt)
    window.promptHub.prompts.update = updatePrompt
    render(<PromptEditor prompt={prompt} />)
    fireEvent.change(screen.getByLabelText('提示词内容'), { target: { value: 'latest patch' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(850)
    })
    expect(screen.getByRole('status')).toHaveTextContent('保存失败')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '重试' }))
    })
    expect(updatePrompt).toHaveBeenLastCalledWith(
      'image-1',
      expect.objectContaining({ content: 'latest patch' })
    )
    expect(screen.getByRole('status')).toHaveTextContent('已保存')
  })

  it('restores an unmounted failed draft and retries its exact latest patch', async () => {
    let rejectCleanup!: (reason: Error) => void
    const updatePrompt = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectCleanup = reject
          })
      )
      .mockResolvedValue(prompt)
    window.promptHub.prompts.update = updatePrompt
    const first = render(<PromptEditor prompt={prompt} />)
    fireEvent.change(screen.getByRole('textbox', { name: /提示词内容/ }), {
      target: { value: 'durable latest' }
    })
    first.unmount()
    await act(async () => rejectCleanup(new Error('offline')))

    render(<PromptEditor prompt={prompt} />)
    expect(screen.getByRole('textbox', { name: /提示词内容/ })).toHaveValue('durable latest')
    expect(screen.getByRole('status')).toHaveTextContent('保存失败')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() =>
      expect(updatePrompt).toHaveBeenLastCalledWith(
        prompt.id,
        expect.objectContaining({ content: 'durable latest' })
      )
    )
  })

  it('clears only the successfully saved revision and isolates drafts by prompt', async () => {
    let resolveOld!: (value: PromptRecord) => void
    window.promptHub.prompts.update = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<PromptRecord>((resolve) => {
            resolveOld = resolve
          })
      )
      .mockResolvedValue(prompt)
    const first = render(<PromptEditor prompt={prompt} />)
    fireEvent.change(screen.getByRole('textbox', { name: /提示词内容/ }), {
      target: { value: 'revision one' }
    })
    first.unmount()
    const secondPrompt = { ...prompt, id: 'image-2', content: 'other source' }
    const other = render(<PromptEditor prompt={secondPrompt} />)
    expect(screen.getByRole('textbox', { name: /提示词内容/ })).toHaveValue('other source')
    other.unmount()
    const remount = render(<PromptEditor prompt={prompt} />)
    fireEvent.change(screen.getByRole('textbox', { name: /提示词内容/ }), {
      target: { value: 'revision two' }
    })
    await act(async () => resolveOld({ ...prompt, content: 'revision one' }))
    remount.unmount()
    render(<PromptEditor prompt={prompt} />)
    expect(screen.getByRole('textbox', { name: /提示词内容/ })).toHaveValue('revision two')
  })

  it('does not let a stale prompt request update the new prompt status', async () => {
    vi.useFakeTimers()
    let rejectOld!: (reason: Error) => void
    window.promptHub.prompts.update = vi.fn().mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectOld = reject
        })
    )
    const { rerender } = render(<PromptEditor prompt={prompt} />)
    fireEvent.change(screen.getByLabelText('提示词内容'), { target: { value: 'old edit' } })
    await vi.advanceTimersByTimeAsync(850)
    rerender(<PromptEditor prompt={{ ...prompt, id: 'image-2', content: 'new prompt' }} />)
    await act(async () => rejectOld(new Error('late failure')))
    expect(screen.getByRole('status')).not.toHaveTextContent('保存失败')
  })

  it('preserves a newer same-prompt edit when an older save updates props', async () => {
    vi.useFakeTimers()
    let resolveA!: (value: PromptRecord) => void
    let resolveB!: (value: PromptRecord) => void
    const updatePrompt = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<PromptRecord>((resolve) => {
            resolveA = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<PromptRecord>((resolve) => {
            resolveB = resolve
          })
      )
    window.promptHub.prompts.update = updatePrompt
    const { rerender } = render(<PromptEditor prompt={prompt} />)

    fireEvent.change(screen.getByLabelText('提示词内容'), { target: { value: 'edit A' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    fireEvent.change(screen.getByLabelText('提示词内容'), { target: { value: 'edit B' } })

    await act(async () => resolveA({ ...prompt, content: 'edit A' }))
    rerender(<PromptEditor prompt={{ ...prompt, content: 'edit A' }} />)
    expect(screen.getByLabelText('提示词内容')).toHaveValue('edit B')
    expect(screen.getByRole('status')).toHaveTextContent('保存中')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(updatePrompt).toHaveBeenLastCalledWith(
      'image-1',
      expect.objectContaining({ content: 'edit B' })
    )
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
    await act(async () => resolveB({ ...prompt, content: 'edit B' }))
    expect(screen.getByRole('status')).toHaveTextContent('已保存')
  })

  it('ignores an older same-prompt error and retries only the newest failed patch', async () => {
    vi.useFakeTimers()
    let rejectA!: (reason: Error) => void
    let rejectB!: (reason: Error) => void
    const updatePrompt = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectA = reject
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectB = reject
          })
      )
      .mockResolvedValue(prompt)
    window.promptHub.prompts.update = updatePrompt
    render(<PromptEditor prompt={prompt} />)
    fireEvent.change(screen.getByLabelText('提示词内容'), { target: { value: 'edit A' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    fireEvent.change(screen.getByLabelText('提示词内容'), { target: { value: 'edit B' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })

    await act(async () => rejectA(new Error('stale failure')))
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
    await act(async () => rejectB(new Error('latest failure')))
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(updatePrompt).toHaveBeenLastCalledWith(
      'image-1',
      expect.objectContaining({ content: 'edit B' })
    )
  })

  it('offers retry only for the latest failed draft', async () => {
    vi.useFakeTimers()
    let rejectLatest!: (reason: Error) => void
    const updatePrompt = vi.fn().mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectLatest = reject
        })
    )
    window.promptHub.prompts.update = updatePrompt
    render(<PromptEditor prompt={prompt} />)
    fireEvent.change(screen.getByLabelText('提示词内容'), { target: { value: 'retry this' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    await act(async () => rejectLatest(new Error('latest failed')))
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('提示词内容'), { target: { value: 'newer local edit' } })
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
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
