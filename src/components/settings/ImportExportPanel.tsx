import { ChangeEvent, useRef } from 'react'

import { IMAGE_TAG, LLM_TAG } from '../../shared/types'

interface LegacyExportedPrompt {
  content: string
  /** Legacy field — pre-merge exports may carry it. */
  type?: 'image' | 'llm'
  title?: string
  notes?: string
  tags?: string[]
  params?: Record<string, unknown>
  previewImage?: string
  isFavorite?: boolean
  lastUsedAt?: string | null
  lastGeneratedAt?: string | null
  useCount?: number
}

export function ImportExportPanel() {
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function handleExport() {
    const prompts = await window.promptHub.prompts.list()
    const settings = await window.promptHub.settings.list()
    const payload = JSON.stringify({ prompts, settings }, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'prompthub-export.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const text = await file.text()
    const payload = JSON.parse(text) as {
      prompts?: LegacyExportedPrompt[]
      settings?: Record<string, unknown>
    }

    for (const prompt of payload.prompts ?? []) {
      // Forward-port legacy `type` field into a tag so old exports still work.
      const baseTags = prompt.tags ?? []
      const legacyTypeTag = prompt.type === 'image' ? IMAGE_TAG : prompt.type === 'llm' ? LLM_TAG : null
      const tags =
        legacyTypeTag && !baseTags.includes(legacyTypeTag)
          ? [legacyTypeTag, ...baseTags]
          : baseTags

      await window.promptHub.prompts.create({
        content: prompt.content,
        title: prompt.title,
        notes: prompt.notes,
        tags,
        params: prompt.params,
        previewImage: prompt.previewImage,
        isFavorite: prompt.isFavorite,
        lastUsedAt: prompt.lastUsedAt,
        lastGeneratedAt: prompt.lastGeneratedAt,
        useCount: prompt.useCount
      })
    }

    for (const [key, value] of Object.entries(payload.settings ?? {})) {
      await window.promptHub.settings.set(key, value)
    }

    event.target.value = ''
  }

  return (
    <div className="import-export-panel">
      <button className="editor-action" type="button" onClick={() => void handleExport()}>
        导出 JSON
      </button>
      <button
        className="editor-action"
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        导入 JSON
      </button>
      <input
        aria-label="导入 JSON 文件"
        ref={inputRef}
        hidden
        accept="application/json"
        type="file"
        onChange={(event) => void handleImport(event)}
      />
    </div>
  )
}
