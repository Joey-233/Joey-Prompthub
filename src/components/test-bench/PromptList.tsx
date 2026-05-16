import type { PromptRecord } from '../../shared/types'

export function PromptList({
  prompts,
  selectedPromptId,
  onSelect
}: {
  prompts: PromptRecord[]
  selectedPromptId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <aside className="bench-prompt-list">
      <h2 className="bench-section-title">选择提示词</h2>
      {prompts.length === 0 ? (
        <div className="bench-empty-copy">暂无可直接保存回库的绘图提示词</div>
      ) : null}
      {prompts.map((prompt) => (
        <button
          key={prompt.id}
          className="bench-prompt-item"
          data-active={selectedPromptId === prompt.id}
          type="button"
          onClick={() => onSelect(prompt.id)}
        >
          <strong>{prompt.title}</strong>
        </button>
      ))}
    </aside>
  )
}
