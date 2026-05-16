import { describe, expect, it, vi } from 'vitest'

import { openaiImageProvider } from './openaiImageProvider'

describe('openaiImageProvider', () => {
  it('forwards generation requests to the main-process bridge', async () => {
    const bridgeResult = {
      providerId: 'openai-image' as const,
      status: 'success' as const,
      effectiveParams: { model: 'gpt-image-1' },
      results: [{ imageData: 'data:image/png;base64,IMG', mimeType: 'image/png' }]
    }
    const openaiGenerate = vi.fn().mockResolvedValue(bridgeResult)
    window.promptHub.image.openaiGenerate = openaiGenerate

    const outcome = await openaiImageProvider.generate({
      prompt: 'a cat in space',
      params: { ...openaiImageProvider.defaultParams }
    })

    expect(openaiGenerate).toHaveBeenCalledWith({
      prompt: 'a cat in space',
      params: { ...openaiImageProvider.defaultParams }
    })
    expect(outcome).toEqual(bridgeResult)
  })

  it('propagates user-facing errors raised in the main process', async () => {
    window.promptHub.image.openaiGenerate = vi
      .fn()
      .mockRejectedValue(new Error('请先在设置页填写 OpenAI 兼容图像服务的 API Key'))

    await expect(
      openaiImageProvider.generate({
        prompt: 'a cat in space',
        params: { ...openaiImageProvider.defaultParams }
      })
    ).rejects.toThrow(/API Key/)
  })

  it('exposes capabilities matching what the workbench renders', () => {
    expect(openaiImageProvider.capabilities.maxBatch).toBeGreaterThanOrEqual(1)
    expect(openaiImageProvider.capabilities.qualities?.length).toBeGreaterThan(0)
    expect(openaiImageProvider.capabilities.sizes?.some((s) => s.id === '1024x1024')).toBe(true)
    expect(openaiImageProvider.defaultParams.width).toBe(1024)
  })
})
