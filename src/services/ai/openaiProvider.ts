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

export interface DescribeImageInput {
  imageDataUrl: string
  instruction?: string
  model?: string
}

/** 识图：把图片交给当前 AI 服务的多模态接口，返回反推/描述文本。 */
export async function describeImage(input: DescribeImageInput): Promise<string> {
  return window.promptHub.ai.describeImage({
    imageDataUrl: input.imageDataUrl,
    instruction: input.instruction,
    model: input.model
  })
}
