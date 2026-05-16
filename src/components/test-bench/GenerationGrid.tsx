import { useState } from 'react'

import type { GenerationRecord } from '../../shared/types'

function inferFilename(record: GenerationRecord, index: number) {
  const safeTitle = record.promptTitleSnapshot.replace(/[\\/:*?"<>|]/g, '_').slice(0, 32)
  const stamp = record.createdAt.replace(/[:.]/g, '-')
  const isPng = record.imageData.startsWith('data:image/png') || record.imageData.endsWith('.png')
  const ext = isPng ? 'png' : record.imageData.startsWith('data:image/svg') ? 'svg' : 'png'
  return `${safeTitle || 'prompt'}-${stamp}-${index + 1}.${ext}`
}

export function GenerationGrid({ results }: { results: GenerationRecord[] }) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  if (results.length === 0) {
    return (
      <section className="generation-grid">
        <div className="generation-card generation-card-empty">点「生成」后图像会出现在这里</div>
        <div className="generation-card generation-card-empty">每张可单击放大、复制或下载</div>
        <div className="generation-card generation-card-empty">同一次生成的图会归档到历史里</div>
      </section>
    )
  }

  async function copyImage(src: string) {
    try {
      // Best-effort copy: data URL → blob → ClipboardItem.
      const response = await fetch(src)
      const blob = await response.blob()
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      } else {
        await navigator.clipboard.writeText(src)
      }
    } catch {
      try {
        await navigator.clipboard.writeText(src)
      } catch {
        /* ignore — copy support varies across runtimes */
      }
    }
  }

  function downloadImage(record: GenerationRecord, index: number) {
    const anchor = document.createElement('a')
    anchor.href = record.imageData
    anchor.download = inferFilename(record, index)
    anchor.click()
  }

  return (
    <>
      <section className="generation-grid">
        {results.map((record, index) => (
          <article key={record.id} className="generation-card generation-card-image">
            <button
              aria-label="放大查看"
              className="generation-card-imagebutton"
              type="button"
              onClick={() => setPreviewSrc(record.imageData)}
            >
              <img
                alt={record.promptTitleSnapshot}
                className="generation-card-img"
                src={record.imageData}
              />
            </button>
            <div className="generation-card-actions">
              <span className="generation-card-meta">{record.providerId}</span>
              <button
                className="generation-card-action"
                type="button"
                onClick={() => void copyImage(record.imageData)}
              >
                复制
              </button>
              <button
                className="generation-card-action"
                type="button"
                onClick={() => downloadImage(record, index)}
              >
                下载
              </button>
            </div>
          </article>
        ))}
      </section>

      {previewSrc ? (
        <div
          aria-label="关闭预览"
          className="generation-preview-backdrop"
          role="button"
          tabIndex={0}
          onClick={() => setPreviewSrc(null)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
              setPreviewSrc(null)
            }
          }}
        >
          <img alt="预览" className="generation-preview-image" src={previewSrc} />
        </div>
      ) : null}
    </>
  )
}
