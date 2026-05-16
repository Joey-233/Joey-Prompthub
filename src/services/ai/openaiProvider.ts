export type OptimizeDirection = '增强细节' | '精简表达' | '自定义指令'

export interface OptimizePromptInput {
  content: string
  direction: OptimizeDirection
  customInstruction?: string
  model?: string
}

/**
 * 整个调用过程都在主进程里完成：组装请求 → fetch → 解析返回。
 * 渲染进程只是个转发器，避开浏览器 CORS，apiKey 也不再跨 IPC 暴露。
 */
export async function optimizePrompt(input: OptimizePromptInput): Promise<string> {
  return window.promptHub.ai.optimize({
    content: input.content,
    direction: input.direction,
    customInstruction: input.customInstruction,
    model: input.model
  })
}
