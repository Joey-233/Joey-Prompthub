// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

vi.mock('better-sqlite3', () => {
  type PromptRow = {
    id: string
    title: string
    content: string
    notes: string
    tags: string
    params: string
    preview_image: string
    is_favorite: number
    last_used_at: string | null
    last_generated_at: string | null
    use_count: number
    created_at: string
    updated_at: string
  }

  type GenerationRow = {
    id: string
    prompt_id: string | null
    provider_id: string
    status: 'mocked' | 'success' | 'failed'
    prompt_title_snapshot: string
    prompt_snapshot: string
    image_data: string
    params: string
    created_at: string
  }

  type Seedance2TemplateRow = {
    id: string
    title: string
    data: string
    created_at: string
    updated_at: string
  }

  type Seedance2PresetRow = {
    id: string
    name: string
    tags: string
    segment: string
    created_at: string
    updated_at: string
  }

  class FakeDatabase {
    private prompts: PromptRow[] = []
    private generations: GenerationRow[] = []
    private seedance2Templates: Seedance2TemplateRow[] = []
    private seedance2Presets: Seedance2PresetRow[] = []

    pragma() {}

    exec() {}

    close() {}

    transaction(fn: () => void) {
      return () => fn()
    }

    prepare(sql: string) {
      const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase()

      if (normalized === 'pragma table_info(prompts)') {
        // Tests run against the post-migration schema; signal "no `type` column"
        // so the migration short-circuits without trying to read/drop it.
        return {
          all: () => [
            { name: 'id' },
            { name: 'title' },
            { name: 'content' },
            { name: 'notes' },
            { name: 'tags' },
            { name: 'params' },
            { name: 'preview_image' },
            { name: 'is_favorite' },
            { name: 'last_used_at' },
            { name: 'last_generated_at' },
            { name: 'use_count' },
            { name: 'created_at' },
            { name: 'updated_at' }
          ]
        }
      }

      if (normalized === 'pragma table_info(generations)') {
        return {
          all: () => [
            { name: 'id' },
            { name: 'prompt_id' },
            { name: 'provider_id' },
            { name: 'status' },
            { name: 'prompt_title_snapshot' },
            { name: 'prompt_snapshot' },
            { name: 'image_data' },
            { name: 'params' },
            { name: 'created_at' }
          ]
        }
      }

      if (normalized.startsWith('insert into prompts')) {
        return {
          run: (params: {
            id: string
            title: string
            content: string
            notes: string
            tags: string
            params: string
            previewImage: string
            isFavorite: number
            lastUsedAt: string | null
            lastGeneratedAt: string | null
            useCount: number
          }) => {
            this.prompts.push({
              id: params.id,
              title: params.title,
              content: params.content,
              notes: params.notes,
              tags: params.tags,
              params: params.params,
              preview_image: params.previewImage,
              is_favorite: params.isFavorite,
              last_used_at: params.lastUsedAt,
              last_generated_at: params.lastGeneratedAt,
              use_count: params.useCount,
              created_at: '2026-04-19 00:00:00',
              updated_at: '2026-04-19 00:00:00'
            })
          }
        }
      }

      if (
        normalized.startsWith('select') &&
        normalized.includes('from prompts where id = ?')
      ) {
        return {
          get: (id: string) => this.prompts.find((prompt) => prompt.id === id)
        }
      }

      if (
        normalized.startsWith('select id, title, content, notes, tags, params') &&
        normalized.includes('from prompts')
      ) {
        return {
          all: (...params: string[]) => {
            let rows = [...this.prompts]
            const offset = 0

            if (normalized.includes('(title like ? or content like ?)')) {
              const search = params[offset]?.toLowerCase().replaceAll('%', '') ?? ''
              rows = rows.filter(
                (row) =>
                  row.title.toLowerCase().includes(search) ||
                  row.content.toLowerCase().includes(search)
              )
            }

            return rows.sort((left, right) => right.updated_at.localeCompare(left.updated_at))
          }
        }
      }

      if (normalized.startsWith('update prompts')) {
        return {
          run: (params: {
            id: string
            title: string
            content: string
            notes: string
            tags: string
            params: string
            previewImage: string
            isFavorite: number
            lastUsedAt: string | null
            lastGeneratedAt: string | null
            useCount: number
          }) => {
            const target = this.prompts.find((prompt) => prompt.id === params.id)
            if (!target) {
              return
            }

            Object.assign(target, {
              title: params.title,
              content: params.content,
              notes: params.notes,
              tags: params.tags,
              params: params.params,
              preview_image: params.previewImage,
              is_favorite: params.isFavorite,
              last_used_at: params.lastUsedAt,
              last_generated_at: params.lastGeneratedAt,
              use_count: params.useCount,
              updated_at: '2026-04-19 00:00:01'
            })
          }
        }
      }

      if (normalized.startsWith('delete from prompts where id = ?')) {
        return {
          run: (id: string) => {
            this.prompts = this.prompts.filter((prompt) => prompt.id !== id)
          }
        }
      }

      if (normalized.startsWith('insert into generations')) {
        return {
          run: (params: {
            id: string
            promptId: string | null
            providerId: string
            status: 'mocked' | 'success' | 'failed'
            promptTitleSnapshot: string
            promptSnapshot: string
            imageData: string
            params: string
          }) => {
            this.generations.push({
              id: params.id,
              prompt_id: params.promptId,
              provider_id: params.providerId,
              status: params.status,
              prompt_title_snapshot: params.promptTitleSnapshot,
              prompt_snapshot: params.promptSnapshot,
              image_data: params.imageData,
              params: params.params,
              created_at: '2026-04-19 00:00:02'
            })
          }
        }
      }

      if (normalized.includes('from generations where id = ?')) {
        return {
          get: (id: string) => this.generations.find((generation) => generation.id === id)
        }
      }

      if (normalized.startsWith('select id, prompt_id,')) {
        return {
          all: () =>
            [...this.generations].sort((left, right) =>
              right.created_at.localeCompare(left.created_at)
            )
        }
      }

      if (normalized.startsWith('select key, value from app_settings')) {
        return { all: () => [] }
      }

      if (normalized.startsWith('insert into app_settings')) {
        return { run: () => undefined }
      }

      if (normalized.startsWith('insert into seedance2_templates')) {
        return {
          run: (params: { id: string; title: string; data: string }) => {
            this.seedance2Templates.push({
              ...params,
              created_at: '2026-04-19 00:00:03',
              updated_at: '2026-04-19 00:00:03'
            })
          }
        }
      }

      if (normalized.startsWith('update seedance2_templates')) {
        return {
          run: (params: { id: string; title: string; data: string }) => {
            const target = this.seedance2Templates.find((row) => row.id === params.id)
            if (target) Object.assign(target, params, { updated_at: '2026-04-19 00:00:04' })
          }
        }
      }

      if (normalized.startsWith('delete from seedance2_templates where id = ?')) {
        return {
          run: (id: string) => {
            this.seedance2Templates = this.seedance2Templates.filter((row) => row.id !== id)
          }
        }
      }

      if (normalized.includes('from seedance2_templates where id = ?')) {
        return {
          get: (id: string) => this.seedance2Templates.find((row) => row.id === id)
        }
      }

      if (normalized.includes('from seedance2_templates order by')) {
        return { all: () => [...this.seedance2Templates] }
      }

      if (normalized.startsWith('insert into seedance2_segment_presets')) {
        return {
          run: (params: { id: string; name: string; tags: string; segment: string }) => {
            this.seedance2Presets.push({
              ...params,
              created_at: '2026-04-19 00:00:03',
              updated_at: '2026-04-19 00:00:03'
            })
          }
        }
      }

      if (normalized.startsWith('update seedance2_segment_presets')) {
        return {
          run: (params: { id: string; name: string; tags: string; segment: string }) => {
            const target = this.seedance2Presets.find((row) => row.id === params.id)
            if (target) Object.assign(target, params, { updated_at: '2026-04-19 00:00:04' })
          }
        }
      }

      if (normalized.startsWith('delete from seedance2_segment_presets where id = ?')) {
        return {
          run: (id: string) => {
            this.seedance2Presets = this.seedance2Presets.filter((row) => row.id !== id)
          }
        }
      }

      if (normalized.includes('from seedance2_segment_presets where id = ?')) {
        return {
          get: (id: string) => this.seedance2Presets.find((row) => row.id === id)
        }
      }

      if (normalized.includes('from seedance2_segment_presets order by')) {
        return { all: () => [...this.seedance2Presets] }
      }

      throw new Error(`Unhandled SQL in fake better-sqlite3: ${sql}`)
    }
  }

  return {
    default: FakeDatabase
  }
})

import { createPromptDatabase } from './db'

describe('prompt database', () => {
  it('creates and lists prompts', () => {
    const db = createPromptDatabase(':memory:')
    const created = db.prompts.create({
      content: 'cyberpunk street scene',
      tags: ['绘图']
    })

    expect(created.title).toContain('cyberpunk')
    expect(db.prompts.list()).toHaveLength(1)
    expect(db.prompts.list()[0].tags).toContain('绘图')
  })

  it('persists prompt metadata fields', () => {
    const db = createPromptDatabase(':memory:')
    const created = db.prompts.create({
      title: '收藏提示词',
      content: 'cinematic portrait',
      tags: ['绘图'],
      isFavorite: true,
      lastUsedAt: '2026-04-19T08:00:00.000Z',
      lastGeneratedAt: '2026-04-19T08:10:00.000Z',
      useCount: 3
    })

    expect(created.isFavorite).toBe(true)
    expect(created.lastUsedAt).toBe('2026-04-19T08:00:00.000Z')
    expect(created.lastGeneratedAt).toBe('2026-04-19T08:10:00.000Z')
    expect(created.useCount).toBe(3)
  })

  it('stores prompt title snapshots on generations', () => {
    const db = createPromptDatabase(':memory:')
    const prompt = db.prompts.create({
      title: '赛博朋克街景',
      content: 'cyberpunk street scene',
      tags: ['绘图']
    })

    const created = db.generations.create({
      promptId: prompt.id,
      providerId: 'mock-image',
      status: 'mocked',
      promptTitleSnapshot: prompt.title,
      promptSnapshot: prompt.content,
      imageData: '生成结果 1',
      params: {}
    })

    expect(created.promptTitleSnapshot).toBe('赛博朋克街景')
  })

  it('survives 500 prompt inserts and returns them all', () => {
    const db = createPromptDatabase(':memory:')
    for (let i = 0; i < 500; i += 1) {
      db.prompts.create({
        content: `prompt ${i}`,
        tags: i % 2 === 0 ? ['绘图'] : ['LLM']
      })
    }
    expect(db.prompts.list()).toHaveLength(500)
  })

  it('preserves >100KB content without truncation', () => {
    const db = createPromptDatabase(':memory:')
    const huge = 'a'.repeat(100_000)
    const created = db.prompts.create({ content: huge, tags: ['绘图'] })
    expect(created.content.length).toBe(100_000)
    const reloaded = db.prompts.list().find((p) => p.id === created.id)
    expect(reloaded?.content.length).toBe(100_000)
  })

  it('search treats query as case-insensitive substring', () => {
    const db = createPromptDatabase(':memory:')
    db.prompts.create({ content: 'Cyberpunk街景', tags: ['绘图'] })
    db.prompts.create({ content: 'watercolor floral', tags: ['绘图'] })

    expect(db.prompts.list({ search: 'CYBER' })).toHaveLength(1)
    expect(db.prompts.list({ search: '街景' })).toHaveLength(1)
    expect(db.prompts.list({ search: 'nothing-matches-this' })).toHaveLength(0)
  })

  it('update throws on missing prompt id', () => {
    const db = createPromptDatabase(':memory:')
    expect(() => db.prompts.update('does-not-exist', { content: 'x' })).toThrow(
      /Prompt not found/
    )
  })

  it('delete on missing id is a silent no-op (idempotent)', () => {
    const db = createPromptDatabase(':memory:')
    expect(() => db.prompts.delete('does-not-exist')).not.toThrow()
  })

  it('preserves tag order through round-trip serialization', () => {
    const db = createPromptDatabase(':memory:')
    const tags = ['绘图', '风景', '夜景', 'cyberpunk', '街景']
    const created = db.prompts.create({ content: 'x', tags })
    expect(created.tags).toEqual(tags)
  })

  it('persists and clears the custom preview image', () => {
    const db = createPromptDatabase(':memory:')
    const dataUrl = 'data:image/jpeg;base64,PREVIEW'

    const created = db.prompts.create({
      content: 'cyberpunk street scene',
      tags: ['绘图'],
      previewImage: dataUrl
    })
    expect(created.previewImage).toBe(dataUrl)

    // 不带 previewImage 的更新不应清掉已有预览图
    const untouched = db.prompts.update(created.id, { content: 'updated content' })
    expect(untouched.previewImage).toBe(dataUrl)

    // 显式传空串才清除
    const cleared = db.prompts.update(created.id, { previewImage: '' })
    expect(cleared.previewImage).toBe('')
  })

  it('round-trips arbitrary params JSON', () => {
    const db = createPromptDatabase(':memory:')
    const params = {
      width: 1024,
      height: 1024,
      nested: { sampler: 'Euler a', steps: 28 },
      list: [1, 2, 3]
    }
    const created = db.prompts.create({ content: 'x', tags: ['绘图'], params })
    expect(created.params).toEqual(params)
  })

  it('round-trips Seedance2 templates through create, update, list, and delete', () => {
    const db = createPromptDatabase(':memory:')
    const data = {
      intro: 'opening',
      refGroups: [],
      segments: [],
      segmentsFooter: 'ending',
      style: 'cinematic'
    }

    const created = db.seedance2.createTemplate({ title: 'Storyboard', data })
    expect(created).toMatchObject({ title: 'Storyboard', data })
    expect(db.seedance2.listTemplates()).toEqual([created])

    const updatedData = { ...data, style: 'documentary' }
    const updated = db.seedance2.updateTemplate(created.id, {
      title: 'Updated storyboard',
      data: updatedData
    })
    expect(updated).toMatchObject({ title: 'Updated storyboard', data: updatedData })

    db.seedance2.deleteTemplate(created.id)
    expect(db.seedance2.listTemplates()).toEqual([])
  })

  it('round-trips Seedance2 segment presets through create, update, list, and delete', () => {
    const db = createPromptDatabase(':memory:')
    const segment = {
      id: 'segment-1',
      timeLabel: '0-3s',
      shotType: 'wide',
      description: 'A city wakes up',
      dialog: ''
    }

    const created = db.seedance2.createPreset({
      name: 'Opening',
      tags: ['city', 'wide'],
      segment
    })
    expect(created).toMatchObject({ name: 'Opening', tags: ['city', 'wide'], segment })
    expect(db.seedance2.listPresets()).toEqual([created])

    const updatedSegment = { ...segment, shotType: 'close-up' }
    const updated = db.seedance2.updatePreset(created.id, {
      name: 'Opening close-up',
      tags: ['city'],
      segment: updatedSegment
    })
    expect(updated).toMatchObject({
      name: 'Opening close-up',
      tags: ['city'],
      segment: updatedSegment
    })

    db.seedance2.deletePreset(created.id)
    expect(db.seedance2.listPresets()).toEqual([])
  })
})
