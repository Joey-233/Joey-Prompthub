import { useEffect, useRef, useState, type ChangeEvent, type SetStateAction } from 'react'

import { IMAGE_TAG, type PromptRecord } from '../../shared/types'
import { useDebouncedEffect } from '../../hooks/useDebouncedEffect'
import { readImageFileAsDataUrl } from '../../lib/imageFile'
import { buildUsagePatch } from '../../shared/promptActivity'
import { useAppStore } from '../../stores/appStore'
import { usePromptStore } from '../../stores/promptStore'
import { OptimizePromptDialog } from './OptimizePromptDialog'

const MAX_PREVIEW_IMAGES = 3

function getImages(prompt: PromptRecord): string[] {
  if (prompt.previewImages && prompt.previewImages.length > 0) return prompt.previewImages
  if (prompt.previewImage) return [prompt.previewImage]
  return []
}

function buildDraftPatch(draft: PromptRecord) {
  return {
    content: draft.content,
    notes: draft.notes,
    tags: draft.tags,
    params: draft.params,
    previewImages: getImages(draft)
  }
}

function hasDraftChanges(draft: PromptRecord, source: PromptRecord) {
  return (
    draft.content !== source.content ||
    draft.notes !== source.notes ||
    JSON.stringify(getImages(draft)) !== JSON.stringify(getImages(source)) ||
    JSON.stringify(draft.tags) !== JSON.stringify(source.tags) ||
    JSON.stringify(draft.params) !== JSON.stringify(source.params)
  )
}

export function PromptEditor({ prompt }: { prompt: PromptRecord }) {
  const updatePrompt = usePromptStore((state) => state.updatePrompt)
  const durableDraft = usePromptStore((state) => state.drafts[prompt.id])
  const setDurableDraft = usePromptStore((state) => state.setDraft)
  const saveDurableDraft = usePromptStore((state) => state.saveDraft)
  const deletePrompt = usePromptStore((state) => state.deletePrompt)
  const toggleFavorite = usePromptStore((state) => state.toggleFavorite)
  const openTestBench = useAppStore((state) => state.openTestBench)
  const initialDraft = durableDraft?.prompt ?? prompt
  const [draft, setDraft] = useState(initialDraft)
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const saveStatus = durableDraft?.status ?? 'saved'
  const previewInputRef = useRef<HTMLInputElement | null>(null)
  const dirtyRef = useRef(false)
  const sourcePromptRef = useRef(prompt)

  // Tags are stored as string[] in the data model, but the editor input is a
  // single comma-separated string. We keep the raw text in local state so the
  // user can type 'foo,' (trailing comma) without having it stripped by
  // filter(Boolean) before they get to type the next tag — same applies to
  // partial Chinese IME composition: rebuilding the value from the parsed
  // array on every keystroke would otherwise interrupt the IME.
  const [tagsInput, setTagsInput] = useState(() => initialDraft.tags.join(', '))

  const pendingDraftRef = useRef(draft)
  pendingDraftRef.current = draft
  function updateDraft(action: SetStateAction<PromptRecord>) {
    dirtyRef.current = true
    const next = typeof action === 'function' ? action(pendingDraftRef.current) : action
    pendingDraftRef.current = next
    setDraft(next)
    setDurableDraft(next)
  }

  useEffect(() => {
    return () => {
      const d = pendingDraftRef.current
      if (hasDraftChanges(d, prompt)) {
        void usePromptStore.getState().saveDraft(d.id).catch(() => undefined)
      }
    }
  }, [prompt.id])

  useEffect(() => {
    const switchedPrompt = sourcePromptRef.current.id !== prompt.id
    const currentDraft = pendingDraftRef.current
    const incomingMatchesDraft = !hasDraftChanges(currentDraft, prompt)
    sourcePromptRef.current = prompt
    if (!switchedPrompt && dirtyRef.current && !incomingMatchesDraft) return
    const restored = usePromptStore.getState().drafts[prompt.id]?.prompt ?? prompt
    setDraft(restored)
    pendingDraftRef.current = restored
    setTagsInput(restored.tags.join(', '))
    dirtyRef.current = false
    if (switchedPrompt) {
      setConfirmDelete(false)
      setPreviewError('')
    }
  }, [prompt])

  function savePatch(id: string) {
    return saveDurableDraft(id).catch(() => undefined)
  }

  // Ctrl+V 粘贴图片：从剪贴板抓 image/* 项加入预览
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        void appendPreviewFiles(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // appendPreviewFiles 读 draft（用最新闭包就好），重订阅成本低
  }, [draft])

  function handleDropFiles(e: React.DragEvent) {
    e.preventDefault()
    void appendPreviewFiles(e.dataTransfer.files)
  }

  async function appendPreviewFiles(files: FileList | File[] | null) {
    if (!files || files.length === 0) return
    setPreviewError('')
    const current = getImages(draft)
    const remaining = MAX_PREVIEW_IMAGES - current.length
    if (remaining <= 0) {
      setPreviewError(`最多 ${MAX_PREVIEW_IMAGES} 张，先移除一张再上传`)
      return
    }

    const accepted: File[] = []
    for (const f of Array.from(files)) {
      if (f.type.startsWith('image/')) accepted.push(f)
      if (accepted.length >= remaining) break
    }
    if (accepted.length === 0) return

    try {
      const dataUrls = await Promise.all(
        accepted.map((file) =>
          readImageFileAsDataUrl(file, { maxDimension: 512, quality: 0.8 })
        )
      )
      const next = [...current, ...dataUrls].slice(0, MAX_PREVIEW_IMAGES)
      updateDraft((c) => ({ ...c, previewImages: next, previewImage: next[0] ?? '' }))
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : '预览图读取失败')
    }
  }

  function replacePreviewAt(index: number, dataUrl: string | null) {
    updateDraft((c) => {
      const list = [...getImages(c)]
      if (dataUrl === null) {
        list.splice(index, 1)
      } else {
        list[index] = dataUrl
      }
      return { ...c, previewImages: list, previewImage: list[0] ?? '' }
    })
  }

  async function handlePreviewFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    event.target.value = ''
    await appendPreviewFiles(files)
  }

  useDebouncedEffect(
    () => {
      if (hasDraftChanges(draft, prompt)) {
        void savePatch(draft.id)
      }
    },
    800,
    [draft, prompt, updatePrompt]
  )

  return (
    <aside className="editor-panel">
      <header className="editor-heading">
        <h2>提示词详情</h2>
        <span className="editor-save-status" role="status" data-status={saveStatus}>
          {saveStatus === 'saving' ? '保存中…' : saveStatus === 'error' ? '保存失败' : '已保存'}
        </span>
        {saveStatus === 'error' && durableDraft ? <button className="editor-retry" type="button" onClick={() => void savePatch(prompt.id)}>重试</button> : null}
      </header>
      <div className="editor-fields">
        <label className="field">
          <span className="field-label">提示词内容</span>
          <textarea
            aria-label="提示词内容"
            className="field-textarea field-textarea-mono"
            value={draft.content}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, content: event.target.value }))
            }
          />
        </label>

        <label className="field">
          <span className="field-label">标签（逗号分隔）</span>
          <input
            className="field-input"
            value={tagsInput}
            onChange={(event) => {
              const raw = event.target.value
              setTagsInput(raw)
              updateDraft((current) => ({
                ...current,
                tags: raw
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean)
              }))
            }}
          />
        </label>

        <label className="field">
          <span className="field-label">备注</span>
          <textarea
            aria-label="备注"
            className="field-textarea field-textarea-notes"
            placeholder="给自己留点 context — 灵感来源、效果、调试要点..."
            value={draft.notes}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, notes: event.target.value }))
            }
          />
        </label>

        <div className="field">
          <span className="field-label">
            预览图（最多 {MAX_PREVIEW_IMAGES} 张，hover 卡片可轮播）
          </span>
          <div
            className="editor-preview-grid"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropFiles}
          >
            {getImages(draft).map((src, idx) => (
              <div className="editor-preview-slot" key={`${idx}-${src.slice(-12)}`}>
                <img alt={`预览图 ${idx + 1}`} className="editor-preview-slot-image" src={src} />
                <button
                  aria-label="移除该预览图"
                  className="editor-preview-slot-remove"
                  type="button"
                  onClick={() => replacePreviewAt(idx, null)}
                >
                  ×
                </button>
              </div>
            ))}
            {getImages(draft).length < MAX_PREVIEW_IMAGES && (
              <button
                className="editor-preview-slot editor-preview-slot-add"
                type="button"
                onClick={() => previewInputRef.current?.click()}
                title="点击上传 / Ctrl+V 粘贴 / 拖入图片"
              >
                <span className="editor-preview-slot-add-plus">+</span>
                <span className="editor-preview-slot-add-hint">
                  上传 · 粘贴 · 拖入
                </span>
              </button>
            )}
          </div>
          <input
            ref={previewInputRef}
            hidden
            multiple
            accept="image/*"
            aria-label="上传预览图文件"
            type="file"
            onChange={(event) => void handlePreviewFileChange(event)}
          />
          {previewError ? <p className="field-hint field-hint-error">{previewError}</p> : null}
        </div>
      </div>

      <div className="editor-actions">
        <button
          className="editor-action"
          type="button"
          onClick={() => {
            if (navigator.clipboard) {
              const timestamp = new Date().toISOString()
              const patch = buildUsagePatch(draft, timestamp)
              setDraft((current) => ({ ...current, ...patch }))
              void updatePrompt(draft.id, patch).then(() =>
                navigator.clipboard.writeText(draft.content)
              )
            }
          }}
        >
          复制
        </button>
        <button
          aria-label={draft.isFavorite ? '取消收藏提示词' : '收藏提示词'}
          className="editor-action"
          data-active={draft.isFavorite}
          type="button"
          onClick={() => {
            setDraft((current) => ({ ...current, isFavorite: !current.isFavorite }))
            void toggleFavorite(draft)
          }}
        >
          {draft.isFavorite ? '取消收藏' : '收藏'}
        </button>
        <button
          className="editor-action"
          type="button"
          onClick={() => setShowOptimizeDialog(true)}
        >
          AI 优化
        </button>
        {draft.tags.includes(IMAGE_TAG) ? (
          <button
            className="editor-action editor-action-primary"
            type="button"
            onClick={() => {
              const timestamp = new Date().toISOString()
              const patch = {
                ...buildDraftPatch(draft),
                ...buildUsagePatch(draft, timestamp)
              }
              setDraft((current) => ({ ...current, ...patch }))
              void updatePrompt(draft.id, patch).then(() => openTestBench(draft.id))
            }}
          >
            发送到测试台
          </button>
        ) : null}
        {confirmDelete ? (
          <>
            <button
              className="editor-action editor-action-danger"
              type="button"
              onClick={() => void deletePrompt(draft.id)}
            >
              确认删除
            </button>
            <button
              className="editor-action"
              type="button"
              onClick={() => setConfirmDelete(false)}
            >
              取消
            </button>
          </>
        ) : (
          <button
            className="editor-action editor-action-danger"
            type="button"
            onClick={() => setConfirmDelete(true)}
          >
            删除
          </button>
        )}
      </div>

      {showOptimizeDialog ? (
        <OptimizePromptDialog
          content={draft.content}
          onClose={() => setShowOptimizeDialog(false)}
          onAccept={(value) => {
            updateDraft((current) => ({ ...current, content: value }))
            setShowOptimizeDialog(false)
          }}
        />
      ) : null}
    </aside>
  )
}
