import { describe, expect, it } from 'vitest'

import {
  getImageProvider,
  getImageProviderOrFallback,
  imageProviders,
  listImageProviders
} from './providerRegistry'

describe('image provider registry', () => {
  it('exposes the three first-party providers in priority order', () => {
    const ids = imageProviders.map((provider) => provider.id)
    expect(ids).toEqual(['openai-image', 'sd-webui', 'mock-image'])
  })

  it('falls back to the first registered provider for unknown ids', () => {
    const provider = getImageProviderOrFallback('does-not-exist')
    expect(provider.id).toBe('openai-image')
  })

  it('every registered provider exposes default params and capabilities', () => {
    for (const provider of listImageProviders()) {
      expect(provider.id).toBeTruthy()
      expect(provider.label).toBeTruthy()
      expect(provider.defaultParams.width).toBeGreaterThan(0)
      expect(provider.defaultParams.height).toBeGreaterThan(0)
      expect(provider.capabilities.maxBatch).toBeGreaterThan(0)
    }
  })

  it('mock provider produces a data URL placeholder per item', async () => {
    const mock = getImageProvider('mock-image')!
    const outcome = await mock.generate({
      prompt: 'sunlit forest',
      params: { ...mock.defaultParams, count: 2 }
    })
    expect(outcome.providerId).toBe('mock-image')
    expect(outcome.results).toHaveLength(2)
    for (const item of outcome.results) {
      expect(item.imageData.startsWith('data:image/svg+xml;base64,')).toBe(true)
    }
  })
})
