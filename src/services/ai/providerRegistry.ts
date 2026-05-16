// 兼容旧调用：暴露预设清单作为 provider 选项。新代码请直接 import AI_PRESETS。
import { AI_PRESETS } from './presets'

export const aiProviders = AI_PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.label
}))
