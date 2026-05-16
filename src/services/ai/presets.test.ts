import { describe, expect, it } from 'vitest'

import {
  AI_PRESETS,
  IMAGE_PRESETS,
  findAiPreset,
  findImagePreset
} from './presets'

describe('AI presets', () => {
  it('all preset ids are unique', () => {
    const ids = AI_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('covers the launch-critical providers', () => {
    const ids = new Set(AI_PRESETS.map((p) => p.id))
    for (const required of [
      'openai',
      'anthropic',
      'deepseek',
      'kimi',
      'glm',
      'qwen',
      'doubao',
      'gemini',
      'custom'
    ]) {
      expect(ids.has(required)).toBe(true)
    }
  })

  it('non-custom presets have a non-empty baseURL and defaultModel', () => {
    for (const preset of AI_PRESETS) {
      if (preset.baseUrlEditable) continue
      expect(preset.baseURL).toMatch(/^https?:\/\//)
      expect(preset.defaultModel).toBeTruthy()
    }
  })

  it('baseURLs are well-formed and do not carry a trailing slash', () => {
    for (const preset of AI_PRESETS) {
      if (!preset.baseURL) continue
      expect(preset.baseURL.endsWith('/')).toBe(false)
      // URL constructor would throw on malformed values.
      expect(() => new URL(preset.baseURL)).not.toThrow()
    }
  })

  it('every preset advertises at least one suggested model (except the wildcard custom one)', () => {
    for (const preset of AI_PRESETS) {
      if (preset.id === 'custom') {
        expect(preset.suggestedModels).toEqual([])
        continue
      }
      expect(preset.suggestedModels.length).toBeGreaterThan(0)
    }
  })

  it('findAiPreset falls back to the first preset for invalid ids', () => {
    expect(findAiPreset(null).id).toBe('openai')
    expect(findAiPreset(undefined).id).toBe('openai')
    expect(findAiPreset('does-not-exist').id).toBe('openai')
  })

  it('findAiPreset round-trips for every known id', () => {
    for (const preset of AI_PRESETS) {
      expect(findAiPreset(preset.id).id).toBe(preset.id)
    }
  })
})

describe('Image presets', () => {
  it('all preset ids are unique', () => {
    const ids = IMAGE_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes the launch-critical kinds: openai, sd-webui, mock', () => {
    const kinds = new Set(IMAGE_PRESETS.map((p) => p.kind))
    expect(kinds.has('openai')).toBe(true)
    expect(kinds.has('sd-webui')).toBe(true)
    expect(kinds.has('mock')).toBe(true)
  })

  it('findImagePreset falls back to the first preset for invalid ids', () => {
    expect(findImagePreset(undefined).id).toBe('openai-image')
    expect(findImagePreset('does-not-exist').id).toBe('openai-image')
  })

  it('findImagePreset round-trips for every known id', () => {
    for (const preset of IMAGE_PRESETS) {
      expect(findImagePreset(preset.id).id).toBe(preset.id)
    }
  })

  it('openai-kind presets always carry a baseURL', () => {
    for (const preset of IMAGE_PRESETS) {
      if (preset.kind !== 'openai') continue
      if (preset.baseUrlEditable) continue
      expect(preset.baseURL).toMatch(/^https?:\/\//)
    }
  })
})
