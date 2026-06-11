import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// jsdom 没有 canvas，统一 mock 图片压缩工具
vi.mock('../../lib/imageFile', () => ({
  readImageFileAsDataUrl: vi.fn().mockResolvedValue('data:image/jpeg;base64,MOCKIMG')
}))

import { RecognizeImageDialog } from './RecognizeImageDialog'

function pickFile() {
  return new File(['fake-bytes'], 'sample.png', { type: 'image/png' })
}

describe('RecognizeImageDialog', () => {
  it('runs the full flow: pick image → recognize → accept result', async () => {
    const user = userEvent.setup()
    const describeImage = vi.fn().mockResolvedValue('neon cyberpunk street, rainy night')
    const onAccept = vi.fn()
    window.promptHub.ai.describeImage = describeImage

    render(<RecognizeImageDialog onAccept={onAccept} onClose={() => {}} />)

    // 没选图前识别按钮禁用
    expect(screen.getByRole('button', { name: '开始识别' })).toBeDisabled()

    await user.upload(screen.getByLabelText('选择要识别的图片'), pickFile())
    expect(await screen.findByAltText('待识别图片预览')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '开始识别' }))

    await waitFor(() => {
      expect(
        screen.getByDisplayValue('neon cyberpunk street, rainy night')
      ).toBeInTheDocument()
    })
    expect(describeImage).toHaveBeenCalledWith(
      expect.objectContaining({
        imageDataUrl: 'data:image/jpeg;base64,MOCKIMG',
        instruction: expect.stringContaining('中文提示词')
      })
    )

    await user.click(screen.getByRole('button', { name: '填入快速录入' }))
    expect(onAccept).toHaveBeenCalledWith('neon cyberpunk street, rainy night')
  })

  it('passes the English-mode instruction when that chip is active', async () => {
    const user = userEvent.setup()
    const describeImage = vi.fn().mockResolvedValue('an english prompt')
    window.promptHub.ai.describeImage = describeImage

    render(<RecognizeImageDialog onAccept={() => {}} onClose={() => {}} />)

    await user.upload(screen.getByLabelText('选择要识别的图片'), pickFile())
    await user.click(screen.getByRole('button', { name: '反推提示词（英文）' }))
    await user.click(screen.getByRole('button', { name: '开始识别' }))

    await waitFor(() => {
      expect(describeImage).toHaveBeenCalledWith(
        expect.objectContaining({
          instruction: expect.stringContaining('English text-to-image prompt')
        })
      )
    })
  })

  it('shows main-process errors inline', async () => {
    const user = userEvent.setup()
    window.promptHub.ai.describeImage = vi
      .fn()
      .mockRejectedValue(new Error('AI 调用失败 (400): model does not support image input'))

    render(<RecognizeImageDialog onAccept={() => {}} onClose={() => {}} />)

    await user.upload(screen.getByLabelText('选择要识别的图片'), pickFile())
    await user.click(screen.getByRole('button', { name: '开始识别' }))

    expect(await screen.findByText(/400.*image input/)).toBeInTheDocument()
  })
})
