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

import { callAiOptimize, callAiVision, checkProviderConnection } from './aiCalls'
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

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' }
  })
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

describe('text AI calls', () => {
  it('requires an API key before making a request', async () => {
    vi.mocked(secretStore.reveal).mockReturnValue(null)

    await expect(callAiOptimize(makeDb(), { content: 'x', direction: '增强细节' })).rejects.toThrow(
      'API Key'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses a preset endpoint and returns the assistant content', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: '优化结果' } }] }))

    const result = await callAiOptimize(makeDb({ ai_preset: 'deepseek' }), {
      content: '原始提示词',
      direction: '增强细节'
    })

    expect(result).toBe('优化结果')
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.deepseek.com/chat/completions')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-test')
  })

  it('normalizes a custom endpoint and honors a model override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }))

    await callAiOptimize(
      makeDb({
        ai_preset: 'custom',
        ai_base_url: 'https://gateway.example.com/v1///',
        ai_model: 'saved-model'
      }),
      {
        content: 'x',
        direction: '自定义指令',
        customInstruction: '请改成英文',
        model: 'override-model'
      }
    )

    expect(fetchMock.mock.calls[0][0]).toBe('https://gateway.example.com/v1/chat/completions')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe('override-model')
    expect(body.messages[1].content).toContain('请改成英文')
  })

  it('uses the generic custom instruction when the input is blank', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'ok' } }] }))

    await callAiOptimize(makeDb({ ai_preset: 'doubao' }), {
      content: 'x',
      direction: '自定义指令',
      customInstruction: '   '
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages[1].content).toContain('请优化这个提示词的表达质量')
  })

  it('maps provider failures to a useful message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'invalid key' }, 401))

    await expect(
      callAiOptimize(makeDb({ ai_preset: 'doubao' }), {
        content: 'x',
        direction: '增强细节'
      })
    ).rejects.toThrow('认证失败')
  })

  it('returns an empty string when the provider omits choices', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))

    await expect(
      callAiOptimize(makeDb({ ai_preset: 'doubao' }), {
        content: 'x',
        direction: '增强细节'
      })
    ).resolves.toBe('')
  })
})

describe('vision calls through the text API', () => {
  const imageDataUrl = 'data:image/jpeg;base64,FAKE'

  it('rejects invalid image input before network access', async () => {
    await expect(
      callAiVision(makeDb({ ai_preset: 'doubao' }), { imageDataUrl: 'not-an-image' })
    ).rejects.toThrow('图片数据格式不正确')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the configured text endpoint, model and key', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: '图片描述' } }] }))

    const result = await callAiVision(
      makeDb({
        ai_preset: 'doubao',
        ai_model: 'doubao-seed-2.1-pro'
      }),
      { imageDataUrl }
    )

    expect(result).toBe('图片描述')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe('doubao-seed-2.1-pro')
    expect(body.messages[1].content[1]).toEqual({
      type: 'image_url',
      image_url: { url: imageDataUrl }
    })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-test')
  })
})

describe('connection check', () => {
  it('returns sorted unique model IDs', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: [{ id: 'model-z' }, { id: 'model-a' }, { id: 'model-z' }, {}] })
    )

    const result = await checkProviderConnection(
      makeDb({
        ai_preset: 'custom',
        ai_base_url: 'https://connection-check.example.com/v1',
        ai_model: 'model-a'
      }),
      'ai'
    )

    expect(result.models).toEqual(['model-a', 'model-z'])
    expect(result.message).toContain('2 个模型')
  })
})
