import { describe, expect, it } from 'vitest'

import { AI_PRESETS } from './presets'

describe('provider preset contract', () => {
  it('publishes only the requested text API presets', () => {
    expect(AI_PRESETS.map((preset) => preset.id)).toEqual(['doubao', 'deepseek', 'custom'])
    expect(AI_PRESETS.find((preset) => preset.id === 'doubao')).toMatchObject({
      baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
      suggestedModels: ['doubao-seed-evolving', 'doubao-seed-2.1-pro', 'doubao-seed-2.1-turbo']
    })
    expect(AI_PRESETS.find((preset) => preset.id === 'deepseek')).toMatchObject({
      baseURL: 'https://api.deepseek.com',
      suggestedModels: ['deepseek-v4-flash', 'deepseek-v4-pro']
    })
  })

  it('uses unique IDs, HTTPS remote endpoints, and non-empty defaults', () => {
    expect(new Set(AI_PRESETS.map((preset) => preset.id)).size).toBe(AI_PRESETS.length)
    for (const preset of AI_PRESETS.filter((item) => item.id !== 'custom')) {
      expect(new URL(preset.baseURL).protocol).toBe('https:')
      expect(preset.defaultModel).toBeTruthy()
      expect(preset.suggestedModels).toContain(preset.defaultModel)
    }
  })

  it('does not advertise retired default model aliases', () => {
    const advertised = AI_PRESETS.flatMap((preset) => preset.suggestedModels)
    expect(advertised).not.toEqual(
      expect.arrayContaining(['deepseek-chat', 'deepseek-reasoner', 'kimi-k2-0905-preview'])
    )
  })
})
