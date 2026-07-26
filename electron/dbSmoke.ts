import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import Database from 'better-sqlite3'

import { RELEASE_PROMPT_SEEDS } from '../src/shared/releasePromptSeeds'
import {
  BUILT_IN_SEEDANCE2_TEMPLATE_ID,
  SEEDANCE2_DEFAULT_TEMPLATE_SETTING_KEY
} from '../src/shared/seedance2Default'
import { createPromptDatabase, migrateLegacyDatabaseFile } from './db'

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
const directory = mkdtempSync(join(tmpdir(), 'prompthub-db-smoke-'))
const path = join(directory, 'prompthub.db')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`DB smoke failed: ${message}`)
}

let failure: unknown

try {
  const db = createPromptDatabase(path)
  assert(
    db.prompts.listPage({ limit: 20 }).total === RELEASE_PROMPT_SEEDS.length,
    'release prompt seeds are missing'
  )
  assert(
    db.seedance2.listTemplates()[0]?.id === BUILT_IN_SEEDANCE2_TEMPLATE_ID,
    '默认模板1 is missing'
  )
  assert(
    db.settings.list()[SEEDANCE2_DEFAULT_TEMPLATE_SETTING_KEY] === BUILT_IN_SEEDANCE2_TEMPLATE_ID,
    '默认模板1 is not selected'
  )
  const prompt = db.prompts.create({
    title: 'Smoke title',
    content: 'cinematic smoke prompt',
    tags: ['绘图'],
    previewImages: [PNG]
  })
  assert(prompt.previewImage?.startsWith('prompthub-asset://'), 'image was not externalized')
  assert(db.prompts.listPage({ search: 'smoke', limit: 10 }).total === 1, 'FTS query failed')
  const generation = db.generations.createBatch({
    runId: 'smoke-run',
    records: [
      {
        promptId: prompt.id,
        providerId: 'smoke',
        status: 'success',
        promptTitleSnapshot: prompt.title,
        promptSnapshot: prompt.content,
        imageData: PNG,
        durationMs: 5
      }
    ]
  })
  assert(generation[0]?.runId === 'smoke-run', 'generation transaction failed')
  const backup = db.data.exportBackup()
  assert(
    backup.prompts.length === RELEASE_PROMPT_SEEDS.length + 1 && backup.generations.length === 1,
    'complete backup failed'
  )
  assert(
    backup.prompts[0].previewImage?.startsWith('data:image/png'),
    'backup did not inline assets'
  )
  db.data.importBackup(backup, 'replace')
  assert(
    db.prompts.listPage({ limit: 10 }).total === RELEASE_PROMPT_SEEDS.length + 1,
    'replace import failed'
  )
  assert(db.data.storageStats().assetCount === 1, 'storage accounting failed')
  db.prompts.delete(prompt.id)
  assert(db.generations.list()[0]?.promptId === null, 'ON DELETE SET NULL failed')
  db.close()

  const raw = new Database(path, { readonly: true })
  assert(raw.pragma('user_version', { simple: true }) === 3, 'schema version is wrong')
  assert(raw.pragma('integrity_check', { simple: true }) === 'ok', 'integrity check failed')
  raw.close()

  const legacyDirectory = mkdtempSync(join(tmpdir(), 'prompthub-legacy-smoke-'))
  try {
    const legacyPath = join(legacyDirectory, 'promptvault.db')
    const legacyDb = createPromptDatabase(legacyPath)
    legacyDb.prompts.create({ content: 'legacy prompt' })
    legacyDb.close()
    assert(migrateLegacyDatabaseFile(legacyDirectory), 'legacy migration was not performed')
    assert(existsSync(legacyPath), 'legacy migration removed the source database')
    const migrated = createPromptDatabase(join(legacyDirectory, 'prompthub.db'))
    assert(
      migrated.prompts.listPage({ limit: 10 }).total === RELEASE_PROMPT_SEEDS.length + 1,
      'legacy data was not preserved'
    )
    migrated.close()
  } finally {
    rmSync(legacyDirectory, { recursive: true, force: true })
  }

  const corruptPath = join(directory, 'corrupt.db')
  writeFileSync(corruptPath, 'not-a-sqlite-database')
  let rejectedCorruption = false
  try {
    createPromptDatabase(corruptPath)
  } catch {
    rejectedCorruption = true
  }
  assert(rejectedCorruption, 'corrupt database was silently accepted or overwritten')
} catch (error) {
  failure = error
} finally {
  try {
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  } catch (cleanupError) {
    failure ??= cleanupError
  }
}

if (failure) {
  process.stderr.write(`${failure instanceof Error ? failure.stack : String(failure)}\n`)
  process.exit(1)
}

process.stdout.write('db-smoke: ok\n')
process.exit(0)
