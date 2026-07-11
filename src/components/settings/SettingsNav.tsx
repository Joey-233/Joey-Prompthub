export const SETTINGS_CATEGORIES = [
  { id: 'ai', label: 'AI 服务' },
  { id: 'vision', label: '视觉模型' },
  { id: 'image', label: '图像生成' },
  { id: 'data', label: '数据与应用' }
] as const

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number]['id']

export function SettingsNav({ active, onSelect }: { active: SettingsCategory; onSelect: (category: SettingsCategory) => void }) {
  return <nav className="settings-nav" aria-label="设置分类导航">{SETTINGS_CATEGORIES.map((item) => <button key={item.id} type="button" className={active === item.id ? 'is-active' : ''} aria-current={active === item.id ? 'page' : undefined} onClick={() => onSelect(item.id)}>{item.label}</button>)}</nav>
}
