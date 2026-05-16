import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { app, safeStorage } from 'electron'

type SecretFile = Record<string, string>

function getSecretFilePath() {
  return join(app.getPath('userData'), 'secure-store.json')
}

function readSecrets(): SecretFile {
  const filePath = getSecretFilePath()

  try {
    const content = readFileSync(filePath, 'utf8')
    return JSON.parse(content) as SecretFile
  } catch {
    return {}
  }
}

function writeSecrets(value: SecretFile) {
  const filePath = getSecretFilePath()
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8')
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
    return key in readSecrets()
  },
  reveal(key: string) {
    const secrets = readSecrets()
    const value = secrets[key]
    return value ? decodeSecret(value) : null
  },
  set(key: string, value: string) {
    const secrets = readSecrets()
    secrets[key] = encodeSecret(value)
    writeSecrets(secrets)
  },
  delete(key: string) {
    const secrets = readSecrets()
    delete secrets[key]
    writeSecrets(secrets)
  }
}
