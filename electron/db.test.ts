import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { RELEASE_PROMPT_SEEDS } from '../src/shared/releasePromptSeeds'
import {
  BUILT_IN_SEEDANCE2_TEMPLATE_ID,
  BUILT_IN_SEEDANCE2_TEMPLATE_TITLE,
  SEEDANCE2_DEFAULT_TEMPLATE_SETTING_KEY
} from '../src/shared/seedance2Default'
import { createPromptDatabase, type PromptDatabase } from './db'

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

let directory = ''
let databasePath = ''
let database: PromptDatabase | null = null

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'prompthub-db-test-'))
  databasePath = join(directory, 'prompthub.db')
})

afterEach(() => {
  database?.close()
  database = null
  rmSync(directory, { recursive: true, force: true })
})

function open() {
  database = createPromptDatabase(databasePath)
  return database
}

describe.skipIf(process.versions.modules !== '145')('prompt database (Electron ABI)', () => {
  it('seeds release prompts and 默认模板1 only for a fresh installation', () => {
    const db = open()

    expect(db.prompts.listPage({ limit: 20 }).total).toBe(RELEASE_PROMPT_SEEDS.length)
    expect(db.prompts.listPage({ limit: 20 }).items.map((prompt) => prompt.title)).toEqual(
      RELEASE_PROMPT_SEEDS.map((prompt) => prompt.title)
    )
    expect(db.seedance2.listTemplates()).toEqual([
      expect.objectContaining({
        id: BUILT_IN_SEEDANCE2_TEMPLATE_ID,
        title: BUILT_IN_SEEDANCE2_TEMPLATE_TITLE,
        data: expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({ title: '角色与素材锚定' }),
            expect.objectContaining({ title: '音效设定' })
          ])
        })
      })
    ])
    expect(db.settings.list()[SEEDANCE2_DEFAULT_TEMPLATE_SETTING_KEY]).toBe(
      BUILT_IN_SEEDANCE2_TEMPLATE_ID
    )
  })

  it('creates a versioned, integrity-checked database with required pragmas', () => {
    open().close()
    database = null
    const raw = new Database(databasePath, { readonly: true })
    expect(raw.pragma('user_version', { simple: true })).toBe(3)
    expect(raw.pragma('integrity_check', { simple: true })).toBe('ok')
    expect(raw.pragma('foreign_keys', { simple: true })).toBe(1)
    raw.close()
  })

  it('creates, updates, searches and paginates prompts', () => {
    const db = open()
    const first = db.prompts.create({
      title: 'Cinematic portrait',
      content: 'golden rim light portrait',
      notes: 'important',
      tags: ['绘图', '电影'],
      params: { steps: 28 },
      isFavorite: true
    })
    for (let index = 0; index < 220; index += 1) {
      db.prompts.create({ content: `bulk prompt ${index}`, tags: ['批量'] })
    }

    const searched = db.prompts.listPage({ search: 'important', limit: 20 })
    expect(searched.items.map((item) => item.id)).toEqual([first.id])
    expect(searched.items[0].notes).toBe('')
    expect(db.prompts.get(first.id)?.notes).toBe('important')

    const page = db.prompts.listPage({ tag: '批量', limit: 100, offset: 100 })
    expect(page.items).toHaveLength(100)
    expect(page.total).toBe(220)
    expect(page.hasMore).toBe(true)

    const updated = db.prompts.update(first.id, { title: 'Editable title', content: 'updated' })
    expect(updated.title).toBe('Editable title')
    expect(updated.content).toBe('updated')
  })

  it('preserves large content and structured metadata', () => {
    const db = open()
    const content = '很长的内容'.repeat(25_000)
    const prompt = db.prompts.create({
      content,
      notes: 'notes',
      tags: ['绘图', '长文本'],
      params: { nested: { enabled: true }, array: [1, 'two'] }
    })
    expect(db.prompts.get(prompt.id)).toMatchObject({
      content,
      notes: 'notes',
      tags: ['绘图', '长文本'],
      params: { nested: { enabled: true }, array: [1, 'two'] }
    })
  })

  it('moves image payloads out of SQLite and serves reversible asset URLs', () => {
    const db = open()
    const prompt = db.prompts.create({ content: 'image', previewImages: [PNG_DATA_URL] })
    expect(prompt.previewImage).toMatch(/^prompthub-asset:\/\/local\/[a-f0-9]{64}\.png$/)
    expect(db.assets.toDataUrl(prompt.previewImage!)).toBe(PNG_DATA_URL)

    const raw = new Database(databasePath, { readonly: true })
    const row = raw.prepare('SELECT preview_image FROM prompts WHERE id = ?').get(prompt.id) as {
      preview_image: string
    }
    expect(row.preview_image).not.toContain('base64')
    raw.close()
  })

  it('stores generation runs transactionally and keeps history after prompt deletion', () => {
    const db = open()
    const prompt = db.prompts.create({ content: 'source' })
    const records = db.generations.createBatch({
      runId: 'run-1',
      records: [
        {
          promptId: prompt.id,
          providerId: 'mock-image',
          status: 'success',
          promptTitleSnapshot: prompt.title,
          promptSnapshot: prompt.content,
          imageData: PNG_DATA_URL,
          durationMs: 120,
          params: { count: 2 }
        },
        {
          promptId: prompt.id,
          providerId: 'mock-image',
          status: 'success',
          promptTitleSnapshot: prompt.title,
          promptSnapshot: prompt.content,
          imageData: PNG_DATA_URL,
          durationMs: 120
        }
      ]
    })
    expect(records).toHaveLength(2)
    expect(records.every((record) => record.runId === 'run-1')).toBe(true)
    expect(db.generations.listPage({ limit: 1 })).toMatchObject({ total: 2, hasMore: true })

    db.prompts.delete(prompt.id)
    expect(db.generations.list()[0].promptId).toBeNull()
  })

  it('detects corrupted JSON instead of silently replacing it', () => {
    const db = open()
    const prompt = db.prompts.create({ content: 'source' })
    const raw = new Database(databasePath)
    raw.prepare("UPDATE prompts SET tags = 'not-json' WHERE id = ?").run(prompt.id)
    raw.close()
    expect(() => db.prompts.get(prompt.id)).toThrow(/已损坏/)
  })

  it('creates a pre-migration backup for an existing unversioned database', () => {
    const legacy = new Database(databasePath)
    legacy.exec(`
      CREATE TABLE prompts (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]', params TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)
    legacy
      .prepare('INSERT INTO prompts (id, title, content) VALUES (?, ?, ?)')
      .run('legacy', 'Legacy', 'content')
    legacy.close()

    const db = open()
    expect(db.prompts.get('legacy')?.title).toBe('Legacy')
    expect(db.prompts.listPage({ limit: 20 }).total).toBe(1)
    expect(db.seedance2.listTemplates()).toEqual([])
    expect(readdirSync(directory).some((name) => name.includes('.before-v3-from-v0-'))).toBe(true)
  })

  it('round-trips Seedance2 templates and presets', () => {
    const db = open()
    const template = db.seedance2.createTemplate({
      title: 'Template',
      data: { sections: [{ id: 'intro', title: '开场', kind: 'text', content: 'hello' }] }
    })
    expect(db.seedance2.listTemplates()).toContainEqual(
      expect.objectContaining({ id: template.id, title: 'Template' })
    )
    const preset = db.seedance2.createPreset({
      name: 'Shot',
      tags: ['action'],
      segment: {
        id: 'shot-1',
        timeLabel: '0-3s',
        shotType: 'wide',
        description: 'move',
        dialog: ''
      }
    })
    expect(db.seedance2.listPresets()[0]).toMatchObject({ id: preset.id, tags: ['action'] })
    db.seedance2.deleteTemplate(template.id)
    db.seedance2.deletePreset(preset.id)
    expect(db.seedance2.listTemplates()).toEqual([
      expect.objectContaining({
        id: BUILT_IN_SEEDANCE2_TEMPLATE_ID,
        title: BUILT_IN_SEEDANCE2_TEMPLATE_TITLE
      })
    ])
    expect(db.seedance2.listPresets()).toEqual([])
  })
})
