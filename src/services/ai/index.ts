// 文本 AI 入口：所有厂商都走 OpenAI 兼容协议（baseURL + apiKey + model），
// 在 openaiProvider 中统一处理。预设清单见 ./presets。
export { optimizePrompt } from './openaiProvider'
export type { OptimizeDirection, OptimizePromptInput } from './openaiProvider'
export { AI_PRESETS, findAiPreset } from './presets'
export type { AiPreset } from './presets'
