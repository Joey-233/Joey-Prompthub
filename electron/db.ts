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
  type Seedance2PresetInput,
  type Seedance2PresetRecord,
  type Seedance2TemplateData,
  type Seedance2TemplateInput,
  type Seedance2TemplateRecord,
  type UpdatePromptInput
} from '../src/shared/types'

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
      preview_image TEXT NOT NULL DEFAULT '',
      preview_images TEXT NOT NULL DEFAULT '[]',
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

    CREATE TABLE IF NOT EXISTS seedance2_templates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS seedance2_segment_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      segment TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  ensureColumn(database, 'prompts', 'preview_image', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(database, 'prompts', 'preview_images', "TEXT NOT NULL DEFAULT '[]'")
  // 把旧的单张 preview_image 迁移到 preview_images[0]（仅在数组列为空时）
  database
    .prepare(
      `UPDATE prompts SET preview_images = json_array(preview_image)
       WHERE (preview_images = '[]' OR preview_images IS NULL) AND preview_image != ''`
    )
    .run()
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
      preview_image = @previewImage,
      preview_images = @previewImages,
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
        const images = (input.previewImages ?? (input.previewImage ? [input.previewImage] : []))
          .filter((s): s is string => typeof s === 'string' && s.length > 0)
          .slice(0, 3)
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
        } else if (patch.previewImage !== undefined) {
          nextImages = patch.previewImage ? [patch.previewImage] : []
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
    seedance2: createSeedance2Repo(database),
    close() {
      database.close()
    }
  }
}

function mapTemplateRow(row: SqlSeedance2TemplateRow): Seedance2TemplateRecord {
  return {
    id: row.id,
    title: row.title,
    data: deserializeJson(row.data, {
      intro: '',
      refGroups: [],
      segments: [],
      segmentsFooter: '',
      style: ''
    } as Seedance2TemplateData),
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
    SET title = @title, data = @data, updated_at = datetime('now')
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
    SET name = @name, tags = @tags, segment = @segment, updated_at = datetime('now')
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
