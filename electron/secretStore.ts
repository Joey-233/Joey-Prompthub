import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync
} from 'node:fs'
import { dirname, join } from 'node:path'

import { app, safeStorage } from 'electron'

type SecretFile = Record<string, string>
const ALLOWED_KEYS = new Set(['ai.apiKey', 'vision.apiKey'])

function getSecretFilePath() {
  return join(app.getPath('userData'), 'secure-store.json')
}

function readSecrets(): SecretFile {
  const filePath = getSecretFilePath()

  try {
    const content = readFileSync(filePath, 'utf8')
    const parsed: unknown = JSON.parse(content)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('密钥文件不是对象')
    }
    for (const [key, value] of Object.entries(parsed)) {
      if (!ALLOWED_KEYS.has(key) || typeof value !== 'string') {
        throw new Error('密钥文件包含无效字段')
      }
    }
    return parsed as SecretFile
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw new Error('本地密钥文件损坏或无法读取；为避免覆盖，已停止密钥操作', {
      cause: error
    })
  }
}

function writeSecrets(value: SecretFile) {
  const filePath = getSecretFilePath()
  mkdirSync(dirname(filePath), { recursive: true })
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  const backupPath = `${filePath}.bak`
  let descriptor: number | null = null
  try {
    descriptor = openSync(temporaryPath, 'wx', 0o600)
    writeSync(descriptor, JSON.stringify(value, null, 2), undefined, 'utf8')
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = null
    if (existsSync(filePath)) copyFileSync(filePath, backupPath)
    renameSync(temporaryPath, filePath)
    try {
      chmodSync(filePath, 0o600)
    } catch {
      // Windows primarily relies on the user profile ACL.
    }
  } catch (error) {
    if (descriptor !== null) closeSync(descriptor)
    rmSync(temporaryPath, { force: true })
    throw new Error('密钥保存失败，原文件未被替换', { cause: error })
  }
}

function assertKey(key: string) {
  if (!ALLOWED_KEYS.has(key)) throw new Error('不支持的密钥名称')
}

function encodeSecret(value: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统不支持安全存储')
  }

  return safeStorage.encryptString(value).toString('base64')
}

function decodeSecret(value: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('当前系统不支持安全存储')
  }

  return safeStorage.decryptString(Buffer.from(value, 'base64'))
}

export const secretStore = {
  has(key: string) {
    assertKey(key)
    return key in readSecrets()
  },
  reveal(key: string) {
    assertKey(key)
    const secrets = readSecrets()
    const value = secrets[key]
    return value ? decodeSecret(value) : null
  },
  set(key: string, value: string) {
    assertKey(key)
    if (!value.trim() || value.length > 8_192) throw new Error('API Key 格式不正确')
    const secrets = readSecrets()
    secrets[key] = encodeSecret(value)
    writeSecrets(secrets)
  },
  delete(key: string) {
    assertKey(key)
    const secrets = readSecrets()
    delete secrets[key]
    writeSecrets(secrets)
  }
}
