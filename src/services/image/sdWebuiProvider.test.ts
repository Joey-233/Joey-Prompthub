import { describe, expect, it, vi } from 'vitest'

import { sdWebuiProvider } from './sdWebuiProvider'

describe('sdWebuiProvider', () => {
  it('forwards the request to the main-process bridge', async () => {
    const bridgeResult = {
      providerId: 'sd-webui' as const,
      status: 'success' as const,
      effectiveParams: { width: 768, height: 512 },
      results: [
        { imageData: 'data:image/png;base64,IMG1', mimeType: 'image/png' },
        { imageData: 'data:image/png;base64,IMG2', mimeType: 'image/png' }
      ]
    }
    const sdWebuiGenerate = vi.fn().mockResolvedValue(bridgeResult)
    window.promptHub.image.sdWebuiGenerate = sdWebuiGenerate

    const outcome = await sdWebuiProvider.generate({
      prompt: 'a forest',
      params: { width: 768, height: 512, steps: 20, sampler: 'Euler a', count: 2 }
    })

    expect(sdWebuiGenerate).toHaveBeenCalledWith({
      prompt: 'a forest',
      params: { width: 768, height: 512, steps: 20, sampler: 'Euler a', count: 2 }
    })
    expect(outcome).toEqual(bridgeResult)
  })

  it('surfaces missing-base-url errors raised in the main process', async () => {
    window.promptHub.image.sdWebuiGenerate = vi
      .fn()
      .mockRejectedValue(new Error('请先在设置页填写 SD WebUI 服务地址'))

    await expect(
      sdWebuiProvider.generate({
        prompt: 'a forest',
        params: { ...sdWebuiProvider.defaultParams }
      })
    ).rejects.toThrow(/SD WebUI 服务地址/)
  })
})
