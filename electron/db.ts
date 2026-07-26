import Database from 'better-sqlite3'
import { copyFileSync, existsSync, renameSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import {
  IMAGE_TAG,
  LLM_TAG,
  type AppSettingRecord,
  type CreateGenerationInput,
  type CreatePromptInput,
  type GenerationRecord,
  type ImportPreview,
  type PromptFilter,
  type PromptRecord,
  type PromptHubBackupV1,
  type Seedance2PresetInput,
  type Seedance2PresetRecord,
  type Seedance2StoredTemplateData,
  type Seedance2TemplateInput,
  type Seedance2TemplateRecord,
  type UpdatePromptInput
} from '../src/shared/types'
import {
  BUILT_IN_SEEDANCE2_TEMPLATE_ID,
  BUILT_IN_SEEDANCE2_TEMPLATE_TITLE,
  createBuiltInSeedance2Template,
  SEEDANCE2_DEFAULT_TEMPLATE_SETTING_KEY
} from '../src/shared/seedance2Default'
import { RELEASE_PROMPT_SEEDS } from '../src/shared/releasePromptSeeds'
import { createAssetStore, type AssetStore } from './assetStore'

const LATEST_DATABASE_VERSION = 3
const ISO_NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ','now')"

export function migrateLegacyDatabaseFile(directory: string) {
  const oldPath = join(directory, 'promptvault.db')
  const newPath = join(directory, 'prompthub.db')
  if (existsSync(newPath) || !existsSync(oldPath)) return false

  const legacy = new Database(oldPath)
  try {
    legacy.pragma('wal_checkpoint(TRUNCATE)')
    const integrity = legacy.pragma('integrity_check', { simple: true })
    if (integrity !== 'ok') throw new Error(`旧数据库完整性检查失败：${String(integrity)}`)
  } finally {
    legacy.close()
  }

  const temporaryPath = `${newPath}.${process.pid}.tmp`
  try {
    copyFileSync(oldPath, temporaryPath)
    renameSync(temporaryPath, newPath)
  } catch (error) {
    rmSync(temporaryPath, { force: true })
    throw new Error('旧版数据库迁移失败；原数据库未被修改', { cause: error })
  }
  return true
}

type SqlSeedance2TemplateRow = {
  id: string
  title: string
  data: string
  created_at: string
  updated_at: string
}

type SqlSeedance2PresetRow = {
  id: string
  name: string
  tags: string
  segment: string
  created_at: string
  updated_at: string
}

type SqlPromptRow = {
  id: string
  title: string
  content: string
  notes: string
  tags: string
  params: string
  preview_image: string
  preview_images: string
  is_favorite: number
  last_used_at: string | null
  last_generated_at: string | null
  use_count: number
  created_at: string
  updated_at: string
}

type SqlGenerationRow = {
  id: string
  run_id: string
  prompt_id: string | null
  provider_id: string
  status: GenerationRecord['status']
  prompt_title_snapshot: string
  prompt_snapshot: string
  image_data: string
  error_message: string
  duration_ms: number | null
  params: string
  created_at: string
}

type SqlSettingRow = {
  key: string
  value: string
}

function generateId() {
  return crypto.randomUUID()
}

function createTitle(content: string) {
  return content.trim().slice(0, 20) || '未命名提示词'
}

function serializeJson(value: unknown) {
  return JSON.stringify(value ?? {})
}

function deserializeJson<T>(value: string, fallback: T, context = 'JSON 数据') {
  try {
    return JSON.parse(value) as T
  } catch (error) {
    throw new Error(`${context}已损坏，请从备份恢复或导出诊断信息`, { cause: error })
  }
}

function ensureColumn(
  database: Database.Database,
  table: string,
  column: string,
  definition: string
) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>

  if (!columns.some((item) => item.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

/**
 * One-shot migration: Prompt Hub used to carry a `type` column on prompts
 * (`image` | `llm`). It is now folded into `tags` as the reserved tag values
 * `'绘图'` and `'LLM'`. On databases predating the change, fold each row's
 * type into its tag list, drop the index, then drop the column.
 *
 * This runs at startup; the column-existence check makes it idempotent.
 */
function migrateTypeToTags(database: Database.Database) {
  const columns = database.prepare(`PRAGMA table_info(prompts)`).all() as Array<{ name: string }>

  if (!columns.some((item) => item.name === 'type')) {
    return
  }

  const rows = database
    .prepare<[], { id: string; type: 'image' | 'llm'; tags: string }>(
      `SELECT id, type, tags FROM prompts`
    )
    .all()
  const updateTags = database.prepare(`UPDATE prompts SET tags = ? WHERE id = ?`)

  const apply = database.transaction(() => {
    for (const row of rows) {
      const existing = deserializeJson(row.tags, [] as string[])
      const tagToAdd = row.type === 'image' ? IMAGE_TAG : LLM_TAG
      const next = existing.includes(tagToAdd) ? existing : [tagToAdd, ...existing]
      updateTags.run(JSON.stringify(next), row.id)
    }
    database.exec(`DROP INDEX IF EXISTS idx_prompts_type`)
    database.exec(`ALTER TABLE prompts DROP COLUMN type`)
  })
  apply()
}

function mapPromptRow(row: SqlPromptRow): PromptRecord {
  const images = deserializeJson(row.preview_images ?? '[]', [] as string[]).filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  )
  // Fallback：旧数据可能只有 preview_image
  if (images.length === 0 && row.preview_image) {
    images.push(row.preview_image)
  }
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    notes: row.notes ?? '',
    tags: deserializeJson(row.tags, [] as string[]),
    params: deserializeJson(row.params, {} as Record<string, unknown>),
    previewImage: images[0] ?? '',
    previewImages: images,
    isFavorite: Boolean(row.is_favorite),
    lastUsedAt: row.last_used_at ?? null,
    lastGeneratedAt: row.last_generated_at ?? null,
    useCount: row.use_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapGenerationRow(row: SqlGenerationRow): GenerationRecord {
  return {
    id: row.id,
    runId: row.run_id,
    promptId: row.prompt_id,
    providerId: row.provider_id,
    status: row.status,
    promptTitleSnapshot: row.prompt_title_snapshot,
    promptSnapshot: row.prompt_snapshot,
    imageData: row.image_data,
    errorMessage: row.error_message ?? '',
    durationMs: row.duration_ms ?? null,
    params: deserializeJson(row.params, {} as Record<string, unknown>),
    createdAt: row.created_at
  }
}

function initializeSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      params TEXT NOT NULL DEFAULT '{}',
      preview_image TEXT NOT NULL DEFAULT '',
      preview_images TEXT NOT NULL DEFAULT '[]',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      last_generated_at TEXT,
      use_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${ISO_NOW_SQL}),
      updated_at TEXT NOT NULL DEFAULT (${ISO_NOW_SQL})
    );

    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL DEFAULT '',
      prompt_id TEXT,
      provider_id TEXT NOT NULL,
      status TEXT NOT NULL,
      prompt_title_snapshot TEXT NOT NULL DEFAULT '',
      prompt_snapshot TEXT NOT NULL,
      image_data TEXT NOT NULL,
      error_message TEXT NOT NULL DEFAULT '',
      duration_ms INTEGER,
      params TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (${ISO_NOW_SQL}),
      FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS seedance2_templates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (${ISO_NOW_SQL}),
      updated_at TEXT NOT NULL DEFAULT (${ISO_NOW_SQL})
    );
    CREATE TABLE IF NOT EXISTS seedance2_segment_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      segment TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (${ISO_NOW_SQL}),
      updated_at TEXT NOT NULL DEFAULT (${ISO_NOW_SQL})
    );

    CREATE INDEX IF NOT EXISTS idx_prompts_updated ON prompts(updated_at);
    CREATE INDEX IF NOT EXISTS idx_prompts_favorite ON prompts(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_generations_prompt ON generations(prompt_id);
    CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at);
  `)
}

function ensureGenerationForeignKey(database: Database.Database) {
  const foreignKeys = database.pragma('foreign_key_list(generations)') as
    | Array<{
        table: string
        on_delete: string
      }>
    | undefined
  if (!Array.isArray(foreignKeys)) return
  if (foreignKeys.some((key) => key.table === 'prompts' && key.on_delete === 'SET NULL')) return

  database.pragma('foreign_keys = OFF')
  try {
    database.transaction(() => {
      database.exec(`
        CREATE TABLE generations_next (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL DEFAULT '',
          prompt_id TEXT,
          provider_id TEXT NOT NULL,
          status TEXT NOT NULL,
          prompt_title_snapshot TEXT NOT NULL DEFAULT '',
          prompt_snapshot TEXT NOT NULL,
          image_data TEXT NOT NULL,
          error_message TEXT NOT NULL DEFAULT '',
          duration_ms INTEGER,
          params TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (${ISO_NOW_SQL}),
          FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE SET NULL
        );
        INSERT INTO generations_next
          (id, run_id, prompt_id, provider_id, status, prompt_title_snapshot, prompt_snapshot, image_data, error_message, duration_ms, params, created_at)
        SELECT id, run_id, prompt_id, provider_id, status, prompt_title_snapshot, prompt_snapshot, image_data, error_message, duration_ms, params, created_at
        FROM generations;
        DROP TABLE generations;
        ALTER TABLE generations_next RENAME TO generations;
        CREATE INDEX idx_generations_prompt ON generations(prompt_id);
        CREATE INDEX idx_generations_created ON generations(created_at);
      `)
    })()
  } finally {
    database.pragma('foreign_keys = ON')
  }
}

function initializeFullTextSearch(database: Database.Database) {
  database.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS prompts_fts USING fts5(
      id UNINDEXED,
      title,
      content,
      notes,
      tags,
      tokenize = 'unicode61'
    );
    CREATE TRIGGER IF NOT EXISTS prompts_fts_insert AFTER INSERT ON prompts BEGIN
      INSERT INTO prompts_fts(id, title, content, notes, tags)
      VALUES (new.id, new.title, new.content, new.notes, new.tags);
    END;
    CREATE TRIGGER IF NOT EXISTS prompts_fts_update AFTER UPDATE ON prompts BEGIN
      DELETE FROM prompts_fts WHERE id = old.id;
      INSERT INTO prompts_fts(id, title, content, notes, tags)
      VALUES (new.id, new.title, new.content, new.notes, new.tags);
    END;
    CREATE TRIGGER IF NOT EXISTS prompts_fts_delete AFTER DELETE ON prompts BEGIN
      DELETE FROM prompts_fts WHERE id = old.id;
    END;
    DELETE FROM prompts_fts;
    INSERT INTO prompts_fts(id, title, content, notes, tags)
    SELECT id, title, content, notes, tags FROM prompts;
  `)
}

function createMigrationBackup(
  database: Database.Database,
  databasePath: string,
  fromVersion: number
) {
  database.pragma('wal_checkpoint(TRUNCATE)')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(
    dirname(databasePath),
    `${basename(databasePath, '.db')}.before-v${LATEST_DATABASE_VERSION}-from-v${fromVersion}-${stamp}.db`
  )
  database.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`)
}

function runMigrations(database: Database.Database, databasePath: string, existedBefore: boolean) {
  const rawVersion = database.pragma('user_version', { simple: true })
  const currentVersion = Number.isInteger(rawVersion) ? Number(rawVersion) : 0
  if (currentVersion > LATEST_DATABASE_VERSION) {
    throw new Error('数据库由更高版本的 Joey Prompthub 创建，当前版本无法安全打开')
  }
  if (existedBefore && currentVersion < LATEST_DATABASE_VERSION) {
    createMigrationBackup(database, databasePath, currentVersion)
  }

  initializeSchema(database)
  ensureColumn(database, 'prompts', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(database, 'prompts', 'last_used_at', 'TEXT')
  ensureColumn(database, 'prompts', 'last_generated_at', 'TEXT')
  ensureColumn(database, 'prompts', 'use_count', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(database, 'prompts', 'notes', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'prompts', 'preview_image', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'prompts', 'preview_images', "TEXT NOT NULL DEFAULT '[]'")
  ensureColumn(database, 'generations', 'prompt_title_snapshot', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'generations', 'run_id', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'generations', 'error_message', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'generations', 'duration_ms', 'INTEGER')

  database.transaction(() => {
    database
      .prepare(
        `UPDATE prompts SET preview_images = json_array(preview_image)
       WHERE (preview_images = '[]' OR preview_images IS NULL) AND preview_image != ''`
      )
      .run()
    migrateTypeToTags(database)
  })()
  ensureGenerationForeignKey(database)
  initializeFullTextSearch(database)
  database.pragma(`user_version = ${LATEST_DATABASE_VERSION}`)

  const integrity = database.pragma('integrity_check', { simple: true })
  if (integrity !== undefined && integrity !== 'ok') {
    throw new Error(`数据库完整性检查失败：${String(integrity)}`)
  }
}

function seedFreshInstallDefaults(database: Database.Database) {
  database.transaction(() => {
    const insertPromptSeed = database.prepare(`
      INSERT INTO prompts (
        id, title, content, notes, tags, params, preview_image, preview_images,
        is_favorite, last_used_at, last_generated_at, use_count
      )
      VALUES (?, ?, ?, '', ?, '{}', '', '[]', ?, NULL, NULL, 0)
    `)
    for (const prompt of RELEASE_PROMPT_SEEDS) {
      insertPromptSeed.run(
        prompt.id,
        prompt.title,
        prompt.content,
        serializeJson(prompt.tags),
        Number(prompt.isFavorite)
      )
    }
    database
      .prepare(
        `INSERT INTO seedance2_templates (id, title, data)
         VALUES (?, ?, ?)`
      )
      .run(
        BUILT_IN_SEEDANCE2_TEMPLATE_ID,
        BUILT_IN_SEEDANCE2_TEMPLATE_TITLE,
        serializeJson(createBuiltInSeedance2Template())
      )
    database
      .prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)`)
      .run(SEEDANCE2_DEFAULT_TEMPLATE_SETTING_KEY, serializeJson(BUILT_IN_SEEDANCE2_TEMPLATE_ID))
  })()
}

function migrateEmbeddedAssets(database: Database.Database, assets: AssetStore) {
  const promptRows = database
    .prepare<[], Pick<SqlPromptRow, 'id' | 'preview_image' | 'preview_images'>>(
      'SELECT id, preview_image, preview_images FROM prompts'
    )
    .all()
  const generationRows = database
    .prepare<[], Pick<SqlGenerationRow, 'id' | 'image_data'>>(
      'SELECT id, image_data FROM generations'
    )
    .all()
  const updatePrompt = database.prepare(
    'UPDATE prompts SET preview_image = ?, preview_images = ? WHERE id = ?'
  )
  const updateGeneration = database.prepare('UPDATE generations SET image_data = ? WHERE id = ?')

  database.transaction(() => {
    for (const row of promptRows) {
      const images = deserializeJson(
        row.preview_images || '[]',
        [] as string[],
        `提示词 ${row.id} 的图片列表`
      )
        .filter((item): item is string => typeof item === 'string')
        .map((item) => assets.persist(item))
      const legacy = row.preview_image ? assets.persist(row.preview_image) : ''
      const normalized = images.length > 0 ? images : legacy ? [legacy] : []
      updatePrompt.run(normalized[0] ?? '', serializeJson(normalized), row.id)
    }
    for (const row of generationRows) {
      updateGeneration.run(assets.persist(row.image_data), row.id)
    }
  })()
}

export function createPromptDatabase(databasePath: string) {
  const existedBefore = existsSync(databasePath) && statSync(databasePath).size > 0
  const database = new Database(databasePath)
  let assets: AssetStore
  try {
    database.pragma('busy_timeout = 5000')
    database.pragma('journal_mode = WAL')
    database.pragma('synchronous = NORMAL')
    database.pragma('foreign_keys = ON')
    runMigrations(database, databasePath, existedBefore)
    if (!existedBefore) seedFreshInstallDefaults(database)
    assets = createAssetStore(databasePath)
    migrateEmbeddedAssets(database, assets)
  } catch (error) {
    database.close()
    throw error
  }

  const insertPrompt = database.prepare(`
    INSERT INTO prompts (
      id,
      title,
      content,
      notes,
      tags,
      params,
      preview_image,
      preview_images,
      is_favorite,
      last_used_at,
      last_generated_at,
      use_count
    )
    VALUES (
      @id,
      @title,
      @content,
      @notes,
      @tags,
      @params,
      @previewImage,
      @previewImages,
      @isFavorite,
      @lastUsedAt,
      @lastGeneratedAt,
      @useCount
    )
  `)
  const listPromptBase = `
    SELECT
      id,
      title,
      content,
      notes,
      tags,
      params,
      preview_image,
      preview_images,
      is_favorite,
      last_used_at,
      last_generated_at,
      use_count,
      created_at,
      updated_at
    FROM prompts
  `
  const listPromptSummaryBase = `
    SELECT
      id,
      title,
      substr(content, 1, 1000) AS content,
      '' AS notes,
      tags,
      '{}' AS params,
      preview_image,
      CASE WHEN preview_image = '' THEN '[]' ELSE json_array(preview_image) END AS preview_images,
      is_favorite,
      last_used_at,
      last_generated_at,
      use_count,
      created_at,
      updated_at
    FROM prompts
  `
  const selectPromptById = database.prepare(`
    ${listPromptBase}
    WHERE id = ?
  `)
  const deletePrompt = database.prepare(`DELETE FROM prompts WHERE id = ?`)
  const deleteGeneration = database.prepare(`DELETE FROM generations WHERE id = ?`)
  const clearGenerationsBefore = database.prepare(`DELETE FROM generations WHERE created_at < ?`)
  const updatePromptStatement = database.prepare(`
    UPDATE prompts
    SET
      title = @title,
      content = @content,
      notes = @notes,
      tags = @tags,
      params = @params,
      preview_image = @previewImage,
      preview_images = @previewImages,
      is_favorite = @isFavorite,
      last_used_at = @lastUsedAt,
      last_generated_at = @lastGeneratedAt,
      use_count = @useCount,
      updated_at = ${ISO_NOW_SQL}
    WHERE id = @id
  `)

  const insertGeneration = database.prepare(`
    INSERT INTO generations (
      id,
      run_id,
      prompt_id,
      provider_id,
      status,
      prompt_title_snapshot,
      prompt_snapshot,
      image_data,
      error_message,
      duration_ms,
      params
    ) VALUES (
      @id,
      @runId,
      @promptId,
      @providerId,
      @status,
      @promptTitleSnapshot,
      @promptSnapshot,
      @imageData,
      @errorMessage,
      @durationMs,
      @params
    )
  `)
  const listGenerations = database.prepare<[], SqlGenerationRow>(`
    SELECT
      id,
      run_id,
      prompt_id,
      provider_id,
      status,
      prompt_title_snapshot,
      prompt_snapshot,
      image_data,
      error_message,
      duration_ms,
      params,
      created_at
    FROM generations
    ORDER BY datetime(created_at) DESC
  `)

  const listSettings = database.prepare<[], SqlSettingRow>(
    `SELECT key, value FROM app_settings ORDER BY key ASC`
  )
  const upsertSetting = database.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)
  const selectGenerationById = database.prepare<[string], SqlGenerationRow>(
    `SELECT id, run_id, prompt_id, provider_id, status, prompt_title_snapshot, prompt_snapshot, image_data, error_message, duration_ms, params, created_at FROM generations WHERE id = ?`
  )

  function createGeneration(input: CreateGenerationInput, sharedRunId?: string) {
    const id = generateId()
    insertGeneration.run({
      id,
      runId: sharedRunId ?? input.runId ?? id,
      promptId: input.promptId ?? null,
      providerId: input.providerId,
      status: input.status,
      promptTitleSnapshot: input.promptTitleSnapshot,
      promptSnapshot: input.promptSnapshot,
      imageData: assets.persist(input.imageData),
      errorMessage: input.errorMessage ?? '',
      durationMs: input.durationMs ?? null,
      params: serializeJson(input.params ?? {})
    })
    return mapGenerationRow(selectGenerationById.get(id) as SqlGenerationRow)
  }

  function cleanupUnreferencedAssets() {
    const referenced = new Set<string>()
    const promptRows = database
      .prepare('SELECT preview_image, preview_images FROM prompts')
      .all() as Array<{ preview_image: string; preview_images: string }>
    for (const row of promptRows) {
      if (row.preview_image?.startsWith('prompthub-asset://')) referenced.add(row.preview_image)
      for (const image of deserializeJson(row.preview_images, [] as string[])) {
        if (image.startsWith('prompthub-asset://')) referenced.add(image)
      }
    }
    const generationRows = database.prepare('SELECT image_data FROM generations').all() as Array<{
      image_data: string
    }>
    for (const row of generationRows) {
      if (row.image_data?.startsWith('prompthub-asset://')) referenced.add(row.image_data)
    }
    return assets.cleanup(referenced)
  }

  function databaseBytes() {
    return [databasePath, `${databasePath}-wal`, `${databasePath}-shm`].reduce(
      (total, path) => total + (existsSync(path) ? statSync(path).size : 0),
      0
    )
  }

  const createGenerationBatch = database.transaction(
    (records: CreateGenerationInput[], runId: string) =>
      records.map((record) => createGeneration(record, runId))
  )

  function listPromptPage(filter: PromptFilter = {}) {
    const conditions: string[] = []
    const params: Array<string | number> = []
    if (filter.search?.trim()) {
      const query = filter.search
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => `"${token.replace(/"/g, '""')}"*`)
        .join(' AND ')
      conditions.push('id IN (SELECT id FROM prompts_fts WHERE prompts_fts MATCH ?)')
      params.push(query)
    }
    if (filter.tag) {
      conditions.push('EXISTS (SELECT 1 FROM json_each(prompts.tags) WHERE json_each.value = ?)')
      params.push(filter.tag)
    }
    if (filter.sort === 'favorites') conditions.push('is_favorite = 1')
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
    const order =
      filter.sort === 'recent-used'
        ? 'last_used_at IS NULL, last_used_at DESC, updated_at DESC'
        : filter.sort === 'favorites'
          ? 'is_favorite DESC, updated_at DESC'
          : filter.sort === 'recent-generated'
            ? 'last_generated_at IS NULL, last_generated_at DESC, updated_at DESC'
            : 'updated_at DESC, id DESC'
    const limit = Math.max(1, Math.min(filter.limit ?? 100, 200))
    const offset = Math.max(0, filter.offset ?? 0)
    const items = database
      .prepare<unknown[], SqlPromptRow>(
        `${listPromptSummaryBase}${where} ORDER BY ${order} LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset)
      .map(mapPromptRow)
    const total = Number(
      (
        database
          .prepare<unknown[], { total: number }>(`SELECT COUNT(*) AS total FROM prompts${where}`)
          .get(...params) as { total: number }
      ).total
    )
    return { items, total, hasMore: offset + items.length < total }
  }

  function listGenerationPage(
    filter: { promptId?: string | null; limit?: number; offset?: number } = {}
  ) {
    const conditions: string[] = []
    const params: Array<string> = []
    if (filter.promptId !== undefined) {
      conditions.push(filter.promptId === null ? 'prompt_id IS NULL' : 'prompt_id = ?')
      if (filter.promptId !== null) params.push(filter.promptId)
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
    const limit = Math.max(1, Math.min(filter.limit ?? 100, 200))
    const offset = Math.max(0, filter.offset ?? 0)
    const select = `SELECT id, run_id, prompt_id, provider_id, status, prompt_title_snapshot, prompt_snapshot, image_data, error_message, duration_ms, params, created_at FROM generations`
    const items = database
      .prepare<unknown[], SqlGenerationRow>(
        `${select}${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset)
      .map(mapGenerationRow)
    const total = Number(
      (
        database
          .prepare<unknown[], { total: number }>(
            `SELECT COUNT(*) AS total FROM generations${where}`
          )
          .get(...params) as { total: number }
      ).total
    )
    return { items, total, hasMore: offset + items.length < total }
  }

  function exportBackup(): PromptHubBackupV1 {
    const prompts = database
      .prepare<[], SqlPromptRow>(`${listPromptBase} ORDER BY updated_at DESC`)
      .all()
      .map(mapPromptRow)
      .map((prompt) => {
        const previewImages = (prompt.previewImages ?? []).map((image) => assets.toDataUrl(image))
        return { ...prompt, previewImage: previewImages[0] ?? '', previewImages }
      })
    const generations = listGenerations
      .all()
      .map(mapGenerationRow)
      .map((record) => ({
        ...record,
        imageData: record.imageData ? assets.toDataUrl(record.imageData) : ''
      }))
    const settings = listSettings.all().reduce<Record<string, unknown>>((result, row) => {
      if (!row.key.startsWith('internal.'))
        result[row.key] = deserializeJson(row.value, row.value, `设置 ${row.key}`)
      return result
    }, {})
    const templates = database
      .prepare<[], SqlSeedance2TemplateRow>(
        'SELECT id, title, data, created_at, updated_at FROM seedance2_templates ORDER BY updated_at DESC'
      )
      .all()
      .map(mapTemplateRow)
    const presets = database
      .prepare<[], SqlSeedance2PresetRow>(
        'SELECT id, name, tags, segment, created_at, updated_at FROM seedance2_segment_presets ORDER BY updated_at DESC'
      )
      .all()
      .map(mapPresetRow)
    return {
      format: 'prompthub-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      prompts,
      generations,
      settings,
      seedance2: { templates, presets },
      excludes: ['apiKeys']
    }
  }

  function previewImport(backup: PromptHubBackupV1): ImportPreview {
    const existingIds = new Set<string>()
    for (const table of [
      'prompts',
      'generations',
      'seedance2_templates',
      'seedance2_segment_presets'
    ]) {
      const rows = database.prepare(`SELECT id FROM ${table}`).all() as Array<{ id: string }>
      rows.forEach((row) => existingIds.add(row.id))
    }
    const incoming = [
      ...backup.prompts,
      ...backup.generations,
      ...backup.seedance2.templates,
      ...backup.seedance2.presets
    ]
    return {
      prompts: backup.prompts.length,
      generations: backup.generations.length,
      templates: backup.seedance2.templates.length,
      presets: backup.seedance2.presets.length,
      conflicts: incoming.filter((record) => existingIds.has(record.id)).length
    }
  }

  const importPrompt = database.prepare(`
    INSERT OR IGNORE INTO prompts
      (id, title, content, notes, tags, params, preview_image, preview_images, is_favorite,
       last_used_at, last_generated_at, use_count, created_at, updated_at)
    VALUES
      (@id, @title, @content, @notes, @tags, @params, @previewImage, @previewImages, @isFavorite,
       @lastUsedAt, @lastGeneratedAt, @useCount, @createdAt, @updatedAt)
  `)
  const importGeneration = database.prepare(`
    INSERT OR IGNORE INTO generations
      (id, run_id, prompt_id, provider_id, status, prompt_title_snapshot, prompt_snapshot,
       image_data, error_message, duration_ms, params, created_at)
    VALUES
      (@id, @runId, @promptId, @providerId, @status, @promptTitleSnapshot, @promptSnapshot,
       @imageData, @errorMessage, @durationMs, @params, @createdAt)
  `)
  const importTemplate = database.prepare(`
    INSERT OR IGNORE INTO seedance2_templates (id, title, data, created_at, updated_at)
    VALUES (@id, @title, @data, @createdAt, @updatedAt)
  `)
  const importPreset = database.prepare(`
    INSERT OR IGNORE INTO seedance2_segment_presets (id, name, tags, segment, created_at, updated_at)
    VALUES (@id, @name, @tags, @segment, @createdAt, @updatedAt)
  `)

  function importBackup(backup: PromptHubBackupV1, mode: 'merge' | 'replace') {
    const preview = previewImport(backup)
    createMigrationBackup(database, databasePath, LATEST_DATABASE_VERSION)
    database.transaction(() => {
      if (mode === 'replace') {
        database.exec(`
          DELETE FROM generations;
          DELETE FROM prompts;
          DELETE FROM seedance2_templates;
          DELETE FROM seedance2_segment_presets;
          DELETE FROM app_settings;
        `)
      }
      for (const prompt of backup.prompts) {
        const images = (prompt.previewImages ?? (prompt.previewImage ? [prompt.previewImage] : []))
          .slice(0, 3)
          .map((image) => assets.persist(image))
        importPrompt.run({
          id: prompt.id,
          title: prompt.title,
          content: prompt.content,
          notes: prompt.notes,
          tags: serializeJson(prompt.tags),
          params: serializeJson(prompt.params),
          previewImage: images[0] ?? '',
          previewImages: serializeJson(images),
          isFavorite: Number(prompt.isFavorite),
          lastUsedAt: prompt.lastUsedAt,
          lastGeneratedAt: prompt.lastGeneratedAt,
          useCount: prompt.useCount,
          createdAt: prompt.createdAt,
          updatedAt: prompt.updatedAt
        })
      }
      const promptIds = new Set(
        (database.prepare('SELECT id FROM prompts').all() as Array<{ id: string }>).map(
          (row) => row.id
        )
      )
      for (const record of backup.generations) {
        importGeneration.run({
          id: record.id,
          runId: record.runId || record.id,
          promptId: record.promptId && promptIds.has(record.promptId) ? record.promptId : null,
          providerId: record.providerId,
          status: record.status,
          promptTitleSnapshot: record.promptTitleSnapshot,
          promptSnapshot: record.promptSnapshot,
          imageData: record.imageData ? assets.persist(record.imageData) : '',
          errorMessage: record.errorMessage,
          durationMs: record.durationMs,
          params: serializeJson(record.params),
          createdAt: record.createdAt
        })
      }
      for (const template of backup.seedance2.templates) {
        importTemplate.run({
          id: template.id,
          title: template.title,
          data: serializeJson(template.data),
          createdAt: template.createdAt,
          updatedAt: template.updatedAt
        })
      }
      for (const preset of backup.seedance2.presets) {
        importPreset.run({
          id: preset.id,
          name: preset.name,
          tags: serializeJson(preset.tags),
          segment: serializeJson(preset.segment),
          createdAt: preset.createdAt,
          updatedAt: preset.updatedAt
        })
      }
      for (const [key, value] of Object.entries(backup.settings)) {
        upsertSetting.run({ key, value: serializeJson(value) })
      }
    })()
    cleanupUnreferencedAssets()
    return preview
  }

  return {
    prompts: {
      list(filter: PromptFilter = {}) {
        const conditions: string[] = []
        const params: Array<string> = []

        if (filter.search?.trim()) {
          conditions.push('(title LIKE ? OR content LIKE ?)')
          params.push(`%${filter.search.trim()}%`, `%${filter.search.trim()}%`)
        }

        const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
        const statement = database.prepare<unknown[], SqlPromptRow>(
          `${listPromptBase}${whereClause} ORDER BY datetime(updated_at) DESC`
        )

        return statement.all(...params).map(mapPromptRow)
      },
      listPage: listPromptPage,
      get(id: string) {
        const row = selectPromptById.get(id) as SqlPromptRow | undefined
        return row ? mapPromptRow(row) : null
      },
      create(input: CreatePromptInput) {
        const id = generateId()
        const images = (input.previewImages ?? (input.previewImage ? [input.previewImage] : []))
          .filter((s): s is string => typeof s === 'string' && s.length > 0)
          .slice(0, 3)
          .map((image) => assets.persist(image))
        insertPrompt.run({
          id,
          title: input.title?.trim() || createTitle(input.content),
          content: input.content.trim(),
          notes: input.notes ?? '',
          tags: serializeJson(input.tags ?? []),
          params: serializeJson(input.params ?? {}),
          previewImage: images[0] ?? '',
          previewImages: serializeJson(images),
          isFavorite: input.isFavorite ? 1 : 0,
          lastUsedAt: input.lastUsedAt ?? null,
          lastGeneratedAt: input.lastGeneratedAt ?? null,
          useCount: input.useCount ?? 0
        })

        return mapPromptRow(selectPromptById.get(id) as SqlPromptRow)
      },
      update(id: string, patch: UpdatePromptInput) {
        const current = selectPromptById.get(id) as SqlPromptRow | undefined

        if (!current) {
          throw new Error(`Prompt not found: ${id}`)
        }

        let nextImages: string[]
        if (patch.previewImages !== undefined) {
          nextImages = patch.previewImages
            .filter((s): s is string => typeof s === 'string' && s.length > 0)
            .slice(0, 3)
            .map((image) => assets.persist(image))
        } else if (patch.previewImage !== undefined) {
          nextImages = patch.previewImage ? [assets.persist(patch.previewImage)] : []
        } else {
          nextImages = deserializeJson(current.preview_images ?? '[]', [] as string[]).filter(
            (s): s is string => typeof s === 'string' && s.length > 0
          )
          if (nextImages.length === 0 && current.preview_image) {
            nextImages = [current.preview_image]
          }
        }

        updatePromptStatement.run({
          id,
          title: patch.title?.trim() || current.title,
          content: patch.content ?? current.content,
          notes: patch.notes ?? current.notes ?? '',
          tags: serializeJson(patch.tags ?? deserializeJson(current.tags, [] as string[])),
          params: serializeJson(
            patch.params ?? deserializeJson(current.params, {} as Record<string, unknown>)
          ),
          previewImage: nextImages[0] ?? '',
          previewImages: serializeJson(nextImages),
          isFavorite:
            patch.isFavorite === undefined ? current.is_favorite : Number(patch.isFavorite),
          lastUsedAt: patch.lastUsedAt === undefined ? current.last_used_at : patch.lastUsedAt,
          lastGeneratedAt:
            patch.lastGeneratedAt === undefined ? current.last_generated_at : patch.lastGeneratedAt,
          useCount: patch.useCount ?? current.use_count
        })
        const updated = mapPromptRow(selectPromptById.get(id) as SqlPromptRow)
        if (patch.previewImages !== undefined || patch.previewImage !== undefined)
          cleanupUnreferencedAssets()
        return updated
      },
      delete(id: string) {
        deletePrompt.run(id)
        cleanupUnreferencedAssets()
      }
    },
    generations: {
      list() {
        return listGenerations.all().map(mapGenerationRow)
      },
      listPage: listGenerationPage,
      create(input: CreateGenerationInput) {
        return createGeneration(input)
      },
      createBatch(input: { runId?: string; records: CreateGenerationInput[] }) {
        const runId = input.runId ?? generateId()
        return createGenerationBatch(input.records, runId)
      },
      delete(id: string) {
        deleteGeneration.run(id)
        cleanupUnreferencedAssets()
      },
      clearBefore(isoTimestamp: string) {
        const result = clearGenerationsBefore.run(isoTimestamp)
        cleanupUnreferencedAssets()
        return result.changes
      }
    },
    settings: {
      list() {
        return listSettings
          .all()
          .reduce<Record<string, unknown>>(
            (accumulator: Record<string, unknown>, row: SqlSettingRow) => {
              accumulator[row.key] = deserializeJson(row.value, row.value)
              return accumulator
            },
            {}
          )
      },
      set(key: string, value: AppSettingRecord['value']) {
        upsertSetting.run({
          key,
          value: serializeJson(value)
        })
      }
    },
    data: {
      exportBackup,
      previewImport,
      importBackup,
      storageStats() {
        const assetStats = assets.getStats()
        const dbBytes = databaseBytes()
        return {
          databaseBytes: dbBytes,
          ...assetStats,
          totalBytes: dbBytes + assetStats.assetsBytes
        }
      }
    },
    seedance2: createSeedance2Repo(database),
    assets,
    close() {
      database.pragma('optimize')
      database.pragma('wal_checkpoint(TRUNCATE)')
      database.close()
    }
  }
}

function mapTemplateRow(row: SqlSeedance2TemplateRow): Seedance2TemplateRecord {
  return {
    id: row.id,
    title: row.title,
    data: deserializeJson(row.data, { sections: [] } as Seedance2StoredTemplateData),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapPresetRow(row: SqlSeedance2PresetRow): Seedance2PresetRecord {
  return {
    id: row.id,
    name: row.name,
    tags: deserializeJson(row.tags, [] as string[]),
    segment: deserializeJson(row.segment, {
      id: generateId(),
      timeLabel: '',
      shotType: '',
      description: '',
      dialog: ''
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function createSeedance2Repo(database: Database.Database) {
  const insertTemplate = database.prepare(`
    INSERT INTO seedance2_templates (id, title, data)
    VALUES (@id, @title, @data)
  `)
  const updateTemplate = database.prepare(`
    UPDATE seedance2_templates
    SET title = @title, data = @data, updated_at = ${ISO_NOW_SQL}
    WHERE id = @id
  `)
  const selectTemplate = database.prepare<[string], SqlSeedance2TemplateRow>(`
    SELECT id, title, data, created_at, updated_at
    FROM seedance2_templates WHERE id = ?
  `)
  const listTemplates = database.prepare<[], SqlSeedance2TemplateRow>(`
    SELECT id, title, data, created_at, updated_at
    FROM seedance2_templates ORDER BY datetime(updated_at) DESC
  `)
  const deleteTemplate = database.prepare(`DELETE FROM seedance2_templates WHERE id = ?`)

  const insertPreset = database.prepare(`
    INSERT INTO seedance2_segment_presets (id, name, tags, segment)
    VALUES (@id, @name, @tags, @segment)
  `)
  const updatePreset = database.prepare(`
    UPDATE seedance2_segment_presets
    SET name = @name, tags = @tags, segment = @segment, updated_at = ${ISO_NOW_SQL}
    WHERE id = @id
  `)
  const selectPreset = database.prepare<[string], SqlSeedance2PresetRow>(`
    SELECT id, name, tags, segment, created_at, updated_at
    FROM seedance2_segment_presets WHERE id = ?
  `)
  const listPresets = database.prepare<[], SqlSeedance2PresetRow>(`
    SELECT id, name, tags, segment, created_at, updated_at
    FROM seedance2_segment_presets ORDER BY datetime(updated_at) DESC
  `)
  const deletePreset = database.prepare(`DELETE FROM seedance2_segment_presets WHERE id = ?`)

  return {
    listTemplates(): Seedance2TemplateRecord[] {
      return listTemplates.all().map(mapTemplateRow)
    },
    createTemplate(input: Seedance2TemplateInput): Seedance2TemplateRecord {
      const id = generateId()
      insertTemplate.run({
        id,
        title: input.title?.trim() || '未命名模板',
        data: serializeJson(input.data)
      })
      return mapTemplateRow(selectTemplate.get(id) as SqlSeedance2TemplateRow)
    },
    updateTemplate(id: string, patch: Seedance2TemplateInput): Seedance2TemplateRecord {
      const current = selectTemplate.get(id) as SqlSeedance2TemplateRow | undefined
      if (!current) throw new Error(`Template not found: ${id}`)
      updateTemplate.run({
        id,
        title: patch.title?.trim() || current.title,
        data: serializeJson(patch.data)
      })
      return mapTemplateRow(selectTemplate.get(id) as SqlSeedance2TemplateRow)
    },
    deleteTemplate(id: string) {
      deleteTemplate.run(id)
    },
    listPresets(): Seedance2PresetRecord[] {
      return listPresets.all().map(mapPresetRow)
    },
    createPreset(input: Seedance2PresetInput): Seedance2PresetRecord {
      const id = generateId()
      insertPreset.run({
        id,
        name: input.name?.trim() || '未命名片段',
        tags: serializeJson(input.tags ?? []),
        segment: serializeJson(input.segment)
      })
      return mapPresetRow(selectPreset.get(id) as SqlSeedance2PresetRow)
    },
    updatePreset(id: string, patch: Seedance2PresetInput): Seedance2PresetRecord {
      const current = selectPreset.get(id) as SqlSeedance2PresetRow | undefined
      if (!current) throw new Error(`Preset not found: ${id}`)
      updatePreset.run({
        id,
        name: patch.name?.trim() || current.name,
        tags: serializeJson(patch.tags ?? deserializeJson(current.tags, [] as string[])),
        segment: serializeJson(patch.segment)
      })
      return mapPresetRow(selectPreset.get(id) as SqlSeedance2PresetRow)
    },
    deletePreset(id: string) {
      deletePreset.run(id)
    }
  }
}

export type PromptDatabase = ReturnType<typeof createPromptDatabase>
