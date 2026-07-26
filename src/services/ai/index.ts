// 文本 AI 入口：所有厂商都走 OpenAI 兼容协议（baseURL + apiKey + model），
// 实际 HTTP 调用在主进程 electron/aiCalls.ts，渲染层只做 IPC 转发。
// 预设清单见 ./presets。
export { optimizePrompt, describeImage } from './openaiProvider'
export type { OptimizeDirection, OptimizePromptInput, DescribeImageInput } from './openaiProvider'
export { AI_PRESETS, findAiPreset } from './presets'
export type { AiPreset } from './presets'
