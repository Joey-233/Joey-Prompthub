import Database from 'better-sqlite3'

import {
  IMAGE_TAG,
  LLM_TAG,
  type AppSettingRecord,
  type CreateGenerationInput,
  type CreatePromptInput,
  type GenerationRecord,
  type PromptFilter,
  type PromptRecord,
  type UpdatePromptInput
} from '../src/shared/types'

type SqlPromptRow = {
  id: string
  title: string
  content: string
  notes: string
  tags: string
  params: string
  is_favorite: number
  last_used_at: string | null
  last_generated_at: string | null
  use_count: number
  created_at: string
  updated_at: string
}

type SqlGenerationRow = {
  id: string
  prompt_id: string | null
  provider_id: string
  status: GenerationRecord['status']
  prompt_title_snapshot: string
  prompt_snapshot: string
  image_data: string
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

function deserializeJson<T>(value: string, fallback: T) {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function ensureColumn(
  database: Database.Database,
  table: string,
  column: string,
  definition: string
) {
  const columns = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>

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
  const columns = database
    .prepare(`PRAGMA table_info(prompts)`)
    .all() as Array<{ name: string }>

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
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    notes: row.notes ?? '',
    tags: deserializeJson(row.tags, [] as string[]),
    params: deserializeJson(row.params, {} as Record<string, unknown>),
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
    promptId: row.prompt_id,
    providerId: row.provider_id,
    status: row.status,
    promptTitleSnapshot: row.prompt_title_snapshot,
    promptSnapshot: row.prompt_snapshot,
    imageData: row.image_data,
    params: deserializeJson(row.params, {} as Record<string, unknown>),
    createdAt: row.created_at
  }
}

export function createPromptDatabase(databasePath: string) {
  const database = new Database(databasePath)

  database.pragma('journal_mode = WAL')
  database.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      params TEXT NOT NULL DEFAULT '{}',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      last_generated_at TEXT,
      use_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      prompt_id TEXT,
      provider_id TEXT NOT NULL,
      status TEXT NOT NULL,
      prompt_title_snapshot TEXT NOT NULL DEFAULT '',
      prompt_snapshot TEXT NOT NULL,
      image_data TEXT NOT NULL,
      params TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(prompt_id) REFERENCES prompts(id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompts_updated ON prompts(updated_at);
    CREATE INDEX IF NOT EXISTS idx_prompts_favorite ON prompts(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_generations_prompt ON generations(prompt_id);
    CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at);
  `)

  ensureColumn(database, 'prompts', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(database, 'prompts', 'last_used_at', 'TEXT')
  ensureColumn(database, 'prompts', 'last_generated_at', 'TEXT')
  ensureColumn(database, 'prompts', 'use_count', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(database, 'prompts', 'notes', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'generations', 'prompt_title_snapshot', "TEXT NOT NULL DEFAULT ''")

  migrateTypeToTags(database)

  const insertPrompt = database.prepare(`
    INSERT INTO prompts (
      id,
      title,
      content,
      notes,
      tags,
      params,
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
  const updatePromptStatement = database.prepare(`
    UPDATE prompts
    SET
      title = @title,
      content = @content,
      notes = @notes,
      tags = @tags,
      params = @params,
      is_favorite = @isFavorite,
      last_used_at = @lastUsedAt,
      last_generated_at = @lastGeneratedAt,
      use_count = @useCount,
      updated_at = datetime('now')
    WHERE id = @id
  `)

  const insertGeneration = database.prepare(`
    INSERT INTO generations (
      id,
      prompt_id,
      provider_id,
      status,
      prompt_title_snapshot,
      prompt_snapshot,
      image_data,
      params
    ) VALUES (
      @id,
      @promptId,
      @providerId,
      @status,
      @promptTitleSnapshot,
      @promptSnapshot,
      @imageData,
      @params
    )
  `)
  const listGenerations = database.prepare<[], SqlGenerationRow>(`
    SELECT
      id,
      prompt_id,
      provider_id,
      status,
      prompt_title_snapshot,
      prompt_snapshot,
      image_data,
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
      create(input: CreatePromptInput) {
        const id = generateId()
        insertPrompt.run({
          id,
          title: input.title?.trim() || createTitle(input.content),
          content: input.content.trim(),
          notes: input.notes ?? '',
          tags: serializeJson(input.tags ?? []),
          params: serializeJson(input.params ?? {}),
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

        updatePromptStatement.run({
          id,
          title: patch.title?.trim() || current.title,
          content: patch.content ?? current.content,
          notes: patch.notes ?? current.notes ?? '',
          tags: serializeJson(patch.tags ?? deserializeJson(current.tags, [] as string[])),
          params: serializeJson(
            patch.params ?? deserializeJson(current.params, {} as Record<string, unknown>)
          ),
          isFavorite:
            patch.isFavorite === undefined
              ? current.is_favorite
              : Number(patch.isFavorite),
          lastUsedAt:
            patch.lastUsedAt === undefined ? current.last_used_at : patch.lastUsedAt,
          lastGeneratedAt:
            patch.lastGeneratedAt === undefined
              ? current.last_generated_at
              : patch.lastGeneratedAt,
          useCount: patch.useCount ?? current.use_count
        })

        return mapPromptRow(selectPromptById.get(id) as SqlPromptRow)
      },
      delete(id: string) {
        deletePrompt.run(id)
      }
    },
    generations: {
      list() {
        return listGenerations.all().map(mapGenerationRow)
      },
      create(input: CreateGenerationInput) {
        const id = generateId()
        insertGeneration.run({
          id,
          promptId: input.promptId ?? null,
          providerId: input.providerId,
          status: input.status,
          promptTitleSnapshot: input.promptTitleSnapshot,
          promptSnapshot: input.promptSnapshot,
          imageData: input.imageData,
          params: serializeJson(input.params ?? {})
        })

        return mapGenerationRow(
          database
            .prepare<[string], SqlGenerationRow>(
              `SELECT id, prompt_id, provider_id, status, prompt_title_snapshot, prompt_snapshot, image_data, params, created_at FROM generations WHERE id = ?`
            )
            .get(id) as SqlGenerationRow
        )
      }
    },
    settings: {
      list() {
        return listSettings.all().reduce<Record<string, unknown>>((accumulator: Record<string, unknown>, row: SqlSettingRow) => {
          accumulator[row.key] = deserializeJson(row.value, row.value)
          return accumulator
        }, {})
      },
      set(key: string, value: AppSettingRecord['value']) {
        upsertSetting.run({
          key,
          value: serializeJson(value)
        })
      }
    },
    close() {
      database.close()
    }
  }
}

export type PromptDatabase = ReturnType<typeof createPromptDatabase>
