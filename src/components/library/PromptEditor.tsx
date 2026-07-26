import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type SetStateAction
} from 'react'

import type { PromptRecord } from '../../shared/types'
import { useDebouncedEffect } from '../../hooks/useDebouncedEffect'
import { readImageFileAsDataUrl } from '../../lib/imageFile'
import { buildUsagePatch } from '../../shared/promptActivity'
import { usePromptStore } from '../../stores/promptStore'
import { OptimizePromptDialog } from './OptimizePromptDialog'

const MAX_PREVIEW_IMAGES = 3

function getImages(prompt: PromptRecord): string[] {
  if (prompt.previewImages && prompt.previewImages.length > 0) return prompt.previewImages
  if (prompt.previewImage) return [prompt.previewImage]
  return []
}

function normalizeTags(value: string) {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.slice(0, 40))
    )
  ].slice(0, 20)
}

function hasDraftChanges(draft: PromptRecord, source: PromptRecord) {
  return (
    draft.title !== source.title ||
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
  const initialDraft = durableDraft?.prompt ?? prompt
  const [draft, setDraft] = useState(initialDraft)
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [actionStatus, setActionStatus] = useState('')
  const [actionPending, setActionPending] = useState(false)
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

  useEffect(() => {
    pendingDraftRef.current = draft
  }, [draft])
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
        void usePromptStore
          .getState()
          .saveDraft(d.id)
          .catch(() => undefined)
      }
    }
  }, [prompt])

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
      setActionStatus('')
      setActionPending(false)
    }
  }, [prompt])

  function savePatch(id: string) {
    return saveDurableDraft(id).catch(() => undefined)
  }

  async function handleCopy() {
    setActionStatus('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(draft.content)
    } catch {
      setActionStatus('复制失败，请检查系统剪贴板权限')
      return
    }

    const timestamp = new Date().toISOString()
    const patch = buildUsagePatch(draft, timestamp)
    setDraft((current) => ({ ...current, ...patch }))
    try {
      await updatePrompt(draft.id, patch)
      setActionStatus('已复制')
    } catch {
      setActionStatus('已复制，但使用次数同步失败')
    }
  }

  async function handleFavorite() {
    if (actionPending) return
    const previous = draft.isFavorite
    setActionPending(true)
    setActionStatus('')
    setDraft((current) => ({ ...current, isFavorite: !previous }))
    try {
      await toggleFavorite(draft)
    } catch {
      setDraft((current) => ({ ...current, isFavorite: previous }))
      setActionStatus('收藏状态保存失败')
    } finally {
      setActionPending(false)
    }
  }

  async function handleDelete() {
    if (actionPending) return
    setActionPending(true)
    setActionStatus('')
    try {
      await deletePrompt(draft.id)
    } catch {
      setActionStatus('删除失败，请重试')
      setActionPending(false)
    }
  }

  function handlePaste(event: ReactClipboardEvent<HTMLElement>) {
    const files = [...event.clipboardData.items]
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
    if (files.length > 0) {
      event.preventDefault()
      void appendPreviewFiles(files)
    }
  }

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
        accepted.map((file) => readImageFileAsDataUrl(file, { maxDimension: 512, quality: 0.8 }))
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
    <aside className="editor-panel" onPaste={handlePaste}>
      <header className="editor-heading">
        <h2>提示词详情</h2>
        <span className="editor-save-status" role="status" data-status={saveStatus}>
          {saveStatus === 'saving' ? '保存中…' : saveStatus === 'error' ? '保存失败' : '已保存'}
        </span>
        {saveStatus === 'error' && durableDraft ? (
          <button className="editor-retry" type="button" onClick={() => void savePatch(prompt.id)}>
            重试
          </button>
        ) : null}
      </header>
      <div className="editor-fields">
        <label className="field">
          <span className="field-label">标题</span>
          <input
            aria-label="标题"
            className="field-input"
            maxLength={200}
            value={draft.title}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, title: event.target.value }))
            }
          />
        </label>
        <label className="field editor-primary-field">
          <span className="field-label">提示词内容</span>
          <textarea
            aria-label="提示词内容"
            className="field-textarea field-textarea-mono editor-content-textarea"
            value={draft.content}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, content: event.target.value }))
            }
          />
        </label>

        <details className="editor-section">
          <summary>
            <span>标签</span>
            <span className="editor-section-summary">
              {draft.tags.length > 0 ? `${draft.tags.length} 个` : '未添加'}
            </span>
          </summary>
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
                  tags: normalizeTags(raw)
                }))
              }}
            />
          </label>
        </details>

        <details className="editor-section">
          <summary>
            <span>备注</span>
            <span className="editor-section-summary">
              {draft.notes ? draft.notes.split('\n')[0] : '未添加'}
            </span>
          </summary>
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
        </details>

        <details className="editor-section">
          <summary>
            <span>预览图</span>
            <span className="editor-section-summary">
              {getImages(draft).length > 0 ? `${getImages(draft).length} 张` : '未添加'}
            </span>
          </summary>
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
                  <span className="editor-preview-slot-add-hint">上传 · 粘贴 · 拖入</span>
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
        </details>
      </div>

      <div className="editor-actions">
        <button className="editor-action" type="button" onClick={() => void handleCopy()}>
          复制
        </button>
        <button
          aria-label={draft.isFavorite ? '取消收藏提示词' : '收藏提示词'}
          className="editor-action"
          data-active={draft.isFavorite}
          disabled={actionPending}
          type="button"
          onClick={() => void handleFavorite()}
        >
          {draft.isFavorite ? '取消收藏' : '收藏'}
        </button>
        <button className="editor-action" type="button" onClick={() => setShowOptimizeDialog(true)}>
          AI 优化
        </button>
        {confirmDelete ? (
          <>
            <button
              className="editor-action editor-action-danger"
              disabled={actionPending}
              type="button"
              onClick={() => void handleDelete()}
            >
              {actionPending ? '删除中…' : '确认删除'}
            </button>
            <button className="editor-action" type="button" onClick={() => setConfirmDelete(false)}>
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
      {actionStatus ? (
        <p
          className={actionStatus.includes('失败') ? 'field-hint field-hint-error' : 'field-hint'}
          role="status"
        >
          {actionStatus}
        </p>
      ) : null}

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
