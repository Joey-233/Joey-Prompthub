import { useEffect, useRef, useState } from 'react'

import { IMAGE_TAG, type PromptRecord } from '../../shared/types'
import { useDebouncedEffect } from '../../hooks/useDebouncedEffect'
import { buildUsagePatch } from '../../shared/promptActivity'
import { useAppStore } from '../../stores/appStore'
import { usePromptStore } from '../../stores/promptStore'
import { OptimizePromptDialog } from './OptimizePromptDialog'

function buildDraftPatch(draft: PromptRecord) {
  return {
    content: draft.content,
    notes: draft.notes,
    tags: draft.tags,
    params: draft.params
  }
}

function hasDraftChanges(draft: PromptRecord, source: PromptRecord) {
  return (
    draft.content !== source.content ||
    draft.notes !== source.notes ||
    JSON.stringify(draft.tags) !== JSON.stringify(source.tags) ||
    JSON.stringify(draft.params) !== JSON.stringify(source.params)
  )
}

export function PromptEditor({ prompt }: { prompt: PromptRecord }) {
  const updatePrompt = usePromptStore((state) => state.updatePrompt)
  const deletePrompt = usePromptStore((state) => state.deletePrompt)
  const toggleFavorite = usePromptStore((state) => state.toggleFavorite)
  const openTestBench = useAppStore((state) => state.openTestBench)
  const [draft, setDraft] = useState(prompt)
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Tags are stored as string[] in the data model, but the editor input is a
  // single comma-separated string. We keep the raw text in local state so the
  // user can type 'foo,' (trailing comma) without having it stripped by
  // filter(Boolean) before they get to type the next tag — same applies to
  // partial Chinese IME composition: rebuilding the value from the parsed
  // array on every keystroke would otherwise interrupt the IME.
  const [tagsInput, setTagsInput] = useState(() => prompt.tags.join(', '))

  const pendingDraftRef = useRef(draft)
  pendingDraftRef.current = draft
  const updatePromptRef = useRef(updatePrompt)
  updatePromptRef.current = updatePrompt

  useEffect(() => {
    return () => {
      const d = pendingDraftRef.current
      if (hasDraftChanges(d, prompt)) {
        void updatePromptRef.current(d.id, buildDraftPatch(d))
      }
    }
  }, [prompt.id])

  useEffect(() => {
    setDraft(prompt)
    setTagsInput(prompt.tags.join(', '))
    setConfirmDelete(false)
  }, [prompt])

  useDebouncedEffect(
    () => {
      if (hasDraftChanges(draft, prompt)) {
        void updatePrompt(draft.id, buildDraftPatch(draft))
      }
    },
    800,
    [draft, prompt, updatePrompt]
  )

  return (
    <aside className="editor-panel">
      <div className="editor-fields">
        <label className="field">
          <span className="field-label">提示词内容</span>
          <textarea
            aria-label="提示词内容"
            className="field-textarea field-textarea-mono"
            value={draft.content}
            onChange={(event) =>
              setDraft((current) => ({ ...current, content: event.target.value }))
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
              setDraft((current) => ({
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
              setDraft((current) => ({ ...current, notes: event.target.value }))
            }
          />
        </label>
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
            setDraft((current) => ({ ...current, content: value }))
            setShowOptimizeDialog(false)
          }}
        />
      ) : null}
    </aside>
  )
}
