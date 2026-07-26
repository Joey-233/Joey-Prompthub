import { beforeEach, describe, expect, it, vi } from 'vitest'

const { showMessageBox } = vi.hoisted(() => ({ showMessageBox: vi.fn() }))

vi.mock('electron', () => ({
  dialog: { showMessageBox }
}))

import type { PromptDatabase } from './db'
import { ensureEndpointApproved, resolveEndpointBaseUrl } from './endpointPolicy'

function database(initial: Record<string, unknown> = {}) {
  const settings = { ...initial }
  const set = vi.fn((key: string, value: unknown) => {
    settings[key] = value
  })
  return {
    value: {
      settings: {
        list: vi.fn(() => settings),
        set
      }
    } as unknown as PromptDatabase,
    settings,
    set
  }
}

beforeEach(() => {
  showMessageBox.mockReset()
})

describe('endpoint approval policy', () => {
  it('resolves the configured text endpoint', () => {
    const db = database({ ai_preset: 'deepseek' }).value
    expect(resolveEndpointBaseUrl(db, 'ai')).toBe('https://api.deepseek.com')
  })

  it('allows built-in service URLs without prompting', async () => {
    const db = database({ ai_preset: 'doubao' }).value

    await expect(ensureEndpointApproved(db, 'ai', null)).resolves.toContain('volces.com')
    expect(showMessageBox).not.toHaveBeenCalled()
  })

  it('rejects an unapproved custom endpoint when no live parent exists', async () => {
    const db = database({ ai_base_url: 'https://custom.example.com/v1' }).value

    await expect(ensureEndpointApproved(db, 'ai', null)).rejects.toThrow('请打开主窗口后重试')
    await expect(
      ensureEndpointApproved(db, 'ai', { isDestroyed: () => true } as never)
    ).rejects.toThrow('请打开主窗口后重试')
  })

  it('persists approval by purpose and origin after explicit confirmation', async () => {
    const state = database({ ai_base_url: 'https://custom.example.com/v1' })
    showMessageBox.mockResolvedValue({ response: 1 })

    await expect(
      ensureEndpointApproved(state.value, 'ai', { isDestroyed: () => false } as never)
    ).resolves.toBe('https://custom.example.com/v1')
    expect(state.set).toHaveBeenCalledWith('internal.approved_endpoints', [
      'ai:https://custom.example.com'
    ])

    showMessageBox.mockClear()
    await expect(ensureEndpointApproved(state.value, 'ai', null)).resolves.toBe(
      'https://custom.example.com/v1'
    )
    expect(showMessageBox).not.toHaveBeenCalled()
  })

  it('does not persist a denied custom endpoint', async () => {
    const state = database({ ai_base_url: 'https://custom.example.com/v1' })
    showMessageBox.mockResolvedValue({ response: 0 })

    await expect(
      ensureEndpointApproved(state.value, 'ai', { isDestroyed: () => false } as never)
    ).rejects.toThrow('已取消')
    expect(state.set).not.toHaveBeenCalled()
  })
})
