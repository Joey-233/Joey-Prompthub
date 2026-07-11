import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'

import { IMAGE_TAG, LLM_TAG, TYPE_TAGS } from '../../shared/types'
import { usePromptStore } from '../../stores/promptStore'
import { RecognizeImageDialog } from './RecognizeImageDialog'

const MAX_SUGGESTIONS = 8

function rankSuggestions(
  prompts: ReadonlyArray<{ tags: string[] }>,
  exclude: ReadonlyArray<string>
): string[] {
  const counts = new Map<string, number>()
  for (const prompt of prompts) {
    for (const tag of prompt.tags) {
      if (TYPE_TAGS.includes(tag as (typeof TYPE_TAGS)[number])) continue
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  const excludeSet = new Set(exclude)
  return Array.from(counts.entries())
    .filter(([tag]) => !excludeSet.has(tag))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_SUGGESTIONS)
    .map(([tag]) => tag)
}

export function QuickCapture() {
  const createPrompt = usePromptStore((state) => state.createPrompt)
  const allPrompts = usePromptStore((state) => state.prompts)
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [showRecognizeDialog, setShowRecognizeDialog] = useState(false)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const expanded = focused || content.length > 0 || showRecognizeDialog

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`
  }, [content, expanded])

  const userTags = useMemo(
    () => tags.filter((tag) => !TYPE_TAGS.includes(tag as (typeof TYPE_TAGS)[number])),
    [tags]
  )
  const suggestions = useMemo(() => rankSuggestions(allPrompts, tags), [allPrompts, tags])

  function commitUserTag(raw: string) {
    const value = raw.trim()
    setTagDraft('')
    if (!value) return
    if (TYPE_TAGS.includes(value as (typeof TYPE_TAGS)[number])) {
      // Treat typing "绘图" / "LLM" the same as clicking the type chip.
      toggleTypeTag(value as (typeof TYPE_TAGS)[number])
      return
    }
    setTags((current) => (current.includes(value) ? current : [...current, value]))
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((item) => item !== tag))
  }

  function toggleTypeTag(typeTag: (typeof TYPE_TAGS)[number]) {
    setTags((current) => {
      if (current.includes(typeTag)) {
        return current.filter((tag) => tag !== typeTag)
      }
      // Type tags are conventionally exclusive: replace the other type if present.
      const other = typeTag === IMAGE_TAG ? LLM_TAG : IMAGE_TAG
      return [typeTag, ...current.filter((tag) => tag !== other)]
    })
  }

  function handleTagKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commitUserTag(tagDraft)
      return
    }
    if (event.key === 'Backspace' && tagDraft === '' && userTags.length > 0) {
      event.preventDefault()
      removeTag(userTags[userTags.length - 1])
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = content.trim()
    if (!trimmed) return

    const pending = tagDraft.trim()
    const finalTags =
      pending && !tags.includes(pending) ? [...tags, pending] : tags

    await createPrompt({
      content: trimmed,
      tags: finalTags
    })

    setContent('')
    setTags([])
    setTagDraft('')
  }

  return (
    <form className="capture-panel" data-expanded={expanded} onSubmit={(event) => void handleSubmit(event)}>
      <textarea
        ref={inputRef}
        aria-label="快速录入"
        className="capture-input"
        placeholder="写下或粘贴一段提示词，Ctrl+Enter 保存..."
        value={content}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
      />

      <div className="capture-toolbar">
        <div className="capture-type-group" role="group" aria-label="类型">
          {TYPE_TAGS.map((typeTag) => (
            <button
              key={typeTag}
              aria-pressed={tags.includes(typeTag)}
              className="capture-type-chip"
              data-active={tags.includes(typeTag)}
              type="button"
              onClick={() => toggleTypeTag(typeTag)}
            >
              {typeTag}
            </button>
          ))}
        </div>

        <div className="capture-tag-area" role="list">
          {userTags.map((tag) => (
            <span key={tag} className="capture-tag-chip" role="listitem">
              {tag}
              <button
                aria-label={`移除标签 ${tag}`}
                className="capture-tag-remove"
                type="button"
                onClick={() => removeTag(tag)}
              >
                ×
              </button>
            </span>
          ))}
          <input
            aria-label="添加标签"
            className="capture-tag-input"
            placeholder={userTags.length === 0 ? '+ 标签（回车确认）' : '+'}
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => {
              if (tagDraft.trim()) commitUserTag(tagDraft)
            }}
          />
        </div>

        {suggestions.length > 0 && (
          <div className="capture-suggestions">
            <span className="capture-suggestions-label">已用过</span>
            {suggestions.map((tag) => (
              <button
                key={tag}
                aria-label={`添加已有标签 ${tag}`}
                className="capture-suggestion"
                type="button"
                onClick={() => commitUserTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <button
          className="capture-recognize"
          type="button"
          onClick={() => setShowRecognizeDialog(true)}
        >
          识图
        </button>

        <button className="capture-save" type="submit">
          保存
        </button>
      </div>

      {showRecognizeDialog ? (
        <RecognizeImageDialog
          onClose={() => setShowRecognizeDialog(false)}
          onAccept={(value) => {
            setContent(value)
            // 识图产出基本都是绘图提示词，自动补上 绘图 类型标签
            setTags((current) =>
              current.includes(IMAGE_TAG)
                ? current
                : [IMAGE_TAG, ...current.filter((tag) => tag !== LLM_TAG)]
            )
            setShowRecognizeDialog(false)
          }}
        />
      ) : null}
    </form>
  )
}
