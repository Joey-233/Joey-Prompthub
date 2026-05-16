import { describe, expect, it, vi } from 'vitest'

import { optimizePrompt } from './openaiProvider'

describe('openaiProvider', () => {
  it('forwards the request to the main-process bridge', async () => {
    const optimize = vi.fn().mockResolvedValue('优化后的提示词')
    window.promptHub.ai.optimize = optimize

    const result = await optimizePrompt({
      content: 'watercolor floral illustration',
      direction: '增强细节'
    })

    expect(result).toBe('优化后的提示词')
    expect(optimize).toHaveBeenCalledWith({
      content: 'watercolor floral illustration',
      direction: '增强细节',
      customInstruction: undefined,
      model: undefined
    })
  })

  it('propagates errors from the main-process bridge', async () => {
    window.promptHub.ai.optimize = vi
      .fn()
      .mockRejectedValue(new Error('请先在设置页填写 OpenAI 的 API Key'))

    await expect(
      optimizePrompt({
        content: 'watercolor floral illustration',
        direction: '增强细节'
      })
    ).rejects.toThrow(/API Key/)
  })
})
