// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./secretStore', () => ({
  secretStore: {
    has: vi.fn().mockReturnValue(true),
    reveal: vi.fn().mockReturnValue('sk-test'),
    set: vi.fn(),
    delete: vi.fn()
  }
}))

import { callAiOptimize, callOpenaiImage, callSdWebui } from './aiCalls'
import { secretStore } from './secretStore'

type FakeDb = Parameters<typeof callAiOptimize>[0]

function makeDb(settings: Record<string, unknown> = {}): FakeDb {
  return {
    prompts: {} as never,
    generations: {} as never,
    settings: {
      list: () => settings,
      set: vi.fn()
    },
    close: vi.fn()
  } as unknown as FakeDb
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(secretStore.reveal).mockReturnValue('sk-test')
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('callAiOptimize', () => {
  it('throws when API key is missing', async () => {
    vi.mocked(secretStore.reveal).mockReturnValue(null)
    await expect(
      callAiOptimize(makeDb({}), { content: 'x', direction: '增强细节' })
    ).rejects.toThrow(/API Key/)
  })

  it('uses the preset baseURL when settings.ai_base_url is empty', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'optimized' } }] })
    })
    const db = makeDb({ ai_preset: 'openai' })
    const result = await callAiOptimize(db, { content: 'hello', direction: '增强细节' })
    expect(result).toBe('optimized')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions')
    const init = fetchMock.mock.calls[0][1]
    expect(init.headers.Authorization).toBe('Bearer sk-test')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('strips trailing slashes from user-supplied baseURL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] })
    })
    const db = makeDb({
      ai_preset: 'custom',
      ai_base_url: 'https://example.com/v1//',
      ai_model: 'gpt-4'
    })
    await callAiOptimize(db, { content: 'hello', direction: '精简表达' })
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/v1/chat/completions')
  })

  it('passes through 自定义指令 verbatim in the user message', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] })
    })
    const db = makeDb({ ai_preset: 'openai' })
    await callAiOptimize(db, {
      content: 'x',
      direction: '自定义指令',
      customInstruction: '请改成英文'
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages[1].content).toContain('请改成英文')
  })

  it('uses generic fallback when 自定义指令 is empty', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] })
    })
    const db = makeDb({ ai_preset: 'openai' })
    await callAiOptimize(db, {
      content: 'x',
      direction: '自定义指令',
      customInstruction: '   '
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages[1].content).toContain('请优化这个提示词的表达质量')
  })

  it('surfaces HTTP errors with status and body excerpt', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Invalid API Key'
    })
    const db = makeDb({ ai_preset: 'openai' })
    await expect(
      callAiOptimize(db, { content: 'x', direction: '增强细节' })
    ).rejects.toThrow(/401.*Invalid API Key/)
  })

  it('truncates error body excerpts to 240 chars', async () => {
    const huge = 'X'.repeat(10_000)
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => huge
    })
    const db = makeDb({ ai_preset: 'openai' })
    await callAiOptimize(db, { content: 'x', direction: '增强细节' }).catch((err: Error) => {
      // Error message = `AI 调用失败 (500): <240 chars>` — keep some slack for the prefix.
      expect(err.message.length).toBeLessThan(280)
    })
  })

  it('returns empty string when response has no choices', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({})
    })
    const db = makeDb({ ai_preset: 'openai' })
    const result = await callAiOptimize(db, { content: 'x', direction: '增强细节' })
    expect(result).toBe('')
  })

  it('honors model override when caller provides one', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'x' } }] })
    })
    const db = makeDb({ ai_preset: 'deepseek', ai_model: 'deepseek-chat' })
    await callAiOptimize(db, {
      content: 'x',
      direction: '增强细节',
      model: 'deepseek-reasoner'
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe('deepseek-reasoner')
  })

  it('hits the correct baseURL for every built-in preset', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'x' } }] })
    })
    const expected: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      deepseek: 'https://api.deepseek.com/v1',
      kimi: 'https://api.moonshot.cn/v1',
      glm: 'https://open.bigmodel.cn/api/paas/v4',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      doubao: 'https://ark.cn-beijing.volces.com/api/v3',
      gemini: 'https://generativelanguage.googleapis.com/v1beta/openai'
    }

    for (const [preset, baseURL] of Object.entries(expected)) {
      fetchMock.mockClear()
      await callAiOptimize(makeDb({ ai_preset: preset }), {
        content: 'x',
        direction: '增强细节'
      })
      expect(fetchMock.mock.calls[0][0]).toBe(`${baseURL}/chat/completions`)
    }
  })

  it('handles very long prompts (8KB+) without truncation', async () => {
    const longContent = 'cyberpunk street scene '.repeat(400)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] })
    })
    await callAiOptimize(makeDb({ ai_preset: 'openai' }), {
      content: longContent,
      direction: '增强细节'
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages[1].content).toContain(longContent)
  })
})

describe('callOpenaiImage', () => {
  it('throws when API key is missing', async () => {
    vi.mocked(secretStore.reveal).mockReturnValue(null)
    await expect(
      callOpenaiImage(makeDb({}), {
        prompt: 'x',
        params: { width: 1024, height: 1024, count: 1 }
      })
    ).rejects.toThrow(/API Key/)
  })

  it('issues a single call for gpt-image-1 and decodes b64 results', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ b64_json: 'AAA' }, { b64_json: 'BBB' }]
      })
    })
    const outcome = await callOpenaiImage(makeDb({ image_model: 'gpt-image-1' }), {
      prompt: 'cat',
      params: { width: 1024, height: 1024, count: 2 }
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(outcome.status).toBe('success')
    expect(outcome.results).toHaveLength(2)
    expect(outcome.results[0].imageData).toBe('data:image/png;base64,AAA')
  })

  it('loops calls for DALL·E 3 since each call only returns one image', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'X' }] })
    })
    const outcome = await callOpenaiImage(makeDb({ image_model: 'dall-e-3' }), {
      prompt: 'cat',
      params: { width: 1024, height: 1024, count: 3 }
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(outcome.results).toHaveLength(3)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.response_format).toBe('b64_json')
    expect(body.quality).toBe('standard') // 默认 medium → standard
  })

  it('maps quality=high to hd for DALL·E 3', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'X' }] })
    })
    await callOpenaiImage(makeDb({ image_model: 'dall-e-3' }), {
      prompt: 'cat',
      params: { width: 1024, height: 1024, count: 1, quality: 'high' }
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.quality).toBe('hd')
  })

  it('keeps quality as-is for gpt-image-1 (low/medium/high passthrough)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'X' }] })
    })
    await callOpenaiImage(makeDb({ image_model: 'gpt-image-1' }), {
      prompt: 'cat',
      params: { width: 1024, height: 1024, count: 1, quality: 'high' }
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.quality).toBe('high')
  })

  it('falls back to first size when the requested one does not match preset', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'X' }] })
    })
    await callOpenaiImage(makeDb({ image_model: 'gpt-image-1' }), {
      prompt: 'cat',
      params: { width: 999, height: 999, count: 1 }
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.size).toBe('1024x1024')
  })

  it('clamps count to max 4', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { b64_json: 'A' },
          { b64_json: 'B' },
          { b64_json: 'C' },
          { b64_json: 'D' }
        ]
      })
    })
    await callOpenaiImage(makeDb({ image_model: 'gpt-image-1' }), {
      prompt: 'cat',
      params: { width: 1024, height: 1024, count: 99 }
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.n).toBe(4)
  })

  it('uses Azure / custom baseURL when image_base_url is set', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ b64_json: 'X' }] })
    })
    await callOpenaiImage(
      makeDb({
        image_preset: 'openai-compatible-image',
        image_base_url: 'https://my-azure.example.com/openai/'
      }),
      {
        prompt: 'cat',
        params: { width: 1024, height: 1024, count: 1 }
      }
    )
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://my-azure.example.com/openai/images/generations'
    )
  })

  it('surfaces HTTP errors with status and body excerpt', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded'
    })
    await expect(
      callOpenaiImage(makeDb({ image_model: 'gpt-image-1' }), {
        prompt: 'x',
        params: { width: 1024, height: 1024, count: 1 }
      })
    ).rejects.toThrow(/429.*Rate limit/)
  })

  it('reports failed status when response has no images', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] })
    })
    const outcome = await callOpenaiImage(makeDb({ image_model: 'gpt-image-1' }), {
      prompt: 'x',
      params: { width: 1024, height: 1024, count: 1 }
    })
    expect(outcome.status).toBe('failed')
  })

  it('passes through url-only responses when b64 is missing', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ url: 'https://example.com/img.png' }] })
    })
    const outcome = await callOpenaiImage(makeDb({ image_model: 'gpt-image-1' }), {
      prompt: 'x',
      params: { width: 1024, height: 1024, count: 1 }
    })
    expect(outcome.results[0].imageData).toBe('https://example.com/img.png')
  })
})

describe('callSdWebui', () => {
  it('throws when base URL is missing', async () => {
    await expect(
      callSdWebui(makeDb({}), { prompt: 'x', params: { width: 512, height: 512 } })
    ).rejects.toThrow(/SD WebUI 服务地址/)
  })

  it('posts to /sdapi/v1/txt2img and strips trailing slashes', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ images: ['IMG'] })
    })
    await callSdWebui(makeDb({ image_base_url: 'http://127.0.0.1:7860/' }), {
      prompt: 'forest',
      params: { width: 768, height: 512, steps: 20, sampler: 'Euler a', count: 1 }
    })
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:7860/sdapi/v1/txt2img')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.sampler_name).toBe('Euler a')
    expect(body.steps).toBe(20)
  })

  it('clamps batch_size to max 8', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ images: [] }) })
    await callSdWebui(makeDb({ image_base_url: 'http://127.0.0.1:7860' }), {
      prompt: 'x',
      params: { width: 512, height: 512, count: 99 }
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.batch_size).toBe(8)
  })

  it('applies default steps and sampler when not provided', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ images: ['X'] })
    })
    await callSdWebui(makeDb({ image_base_url: 'http://127.0.0.1:7860' }), {
      prompt: 'x',
      params: { width: 512, height: 512 }
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.steps).toBe(28)
    expect(body.sampler_name).toBe('DPM++ 2M Karras')
  })

  it('accepts both raw b64 and data: URLs from WebUI responses', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ images: ['RAW', 'data:image/png;base64,READY'] })
    })
    const outcome = await callSdWebui(
      makeDb({ image_base_url: 'http://127.0.0.1:7860' }),
      {
        prompt: 'x',
        params: { width: 512, height: 512, count: 2 }
      }
    )
    expect(outcome.results[0].imageData).toBe('data:image/png;base64,RAW')
    expect(outcome.results[1].imageData).toBe('data:image/png;base64,READY')
  })

  it('surfaces non-2xx with status and body excerpt', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'CUDA out of memory'
    })
    await expect(
      callSdWebui(makeDb({ image_base_url: 'http://127.0.0.1:7860' }), {
        prompt: 'x',
        params: { width: 512, height: 512 }
      })
    ).rejects.toThrow(/500.*CUDA/)
  })
})
