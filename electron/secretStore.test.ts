// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userData: { path: '' },
  encryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((value: string) => Buffer.from(`encrypted:${value}`)),
  decryptString: vi.fn((value: Buffer) => value.toString().replace(/^encrypted:/, ''))
}))

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => mocks.userData.path) },
  safeStorage: {
    isEncryptionAvailable: mocks.encryptionAvailable,
    encryptString: mocks.encryptString,
    decryptString: mocks.decryptString
  }
}))

import { secretStore } from './secretStore'

beforeEach(() => {
  mocks.userData.path = mkdtempSync(join(tmpdir(), 'joey-prompthub-secrets-'))
  mocks.encryptionAvailable.mockReturnValue(true)
  mocks.encryptString.mockClear()
  mocks.decryptString.mockClear()
})

afterEach(() => {
  rmSync(mocks.userData.path, { recursive: true, force: true })
})

describe('encrypted secret store', () => {
  it('round-trips an encrypted key without writing plaintext', () => {
    secretStore.set('ai.apiKey', 'sk-user-secret')

    expect(secretStore.has('ai.apiKey')).toBe(true)
    expect(secretStore.reveal('ai.apiKey')).toBe('sk-user-secret')
    const stored = readFileSync(join(mocks.userData.path, 'secure-store.json'), 'utf8')
    expect(stored).not.toContain('sk-user-secret')
    expect(mocks.encryptString).toHaveBeenCalledWith('sk-user-secret')
  })

  it('deletes a saved key and returns null afterward', () => {
    secretStore.set('ai.apiKey', 'key')
    secretStore.delete('ai.apiKey')

    expect(secretStore.has('ai.apiKey')).toBe(false)
    expect(secretStore.reveal('ai.apiKey')).toBeNull()
  })

  it('rejects unsupported names and malformed values', () => {
    expect(() => secretStore.has('other.key')).toThrow('不支持的密钥名称')
    expect(() => secretStore.set('ai.apiKey', '   ')).toThrow('API Key 格式不正确')
    expect(() => secretStore.set('ai.apiKey', 'x'.repeat(8_193))).toThrow('API Key 格式不正确')
  })

  it('fails closed when OS encryption is unavailable', () => {
    mocks.encryptionAvailable.mockReturnValue(false)

    expect(() => secretStore.set('ai.apiKey', 'secret')).toThrow('当前系统不支持安全存储')
    expect(() => secretStore.reveal('ai.apiKey')).not.toThrow()
  })

  it('refuses to overwrite a corrupt secret file', () => {
    const path = join(mocks.userData.path, 'secure-store.json')
    writeFileSync(path, '{"unexpected":"field"}', 'utf8')

    expect(() => secretStore.set('ai.apiKey', 'new-secret')).toThrow('本地密钥文件损坏或无法读取')
    expect(readFileSync(path, 'utf8')).toBe('{"unexpected":"field"}')
  })
})
