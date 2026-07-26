export type ThemeMode = 'light' | 'dark' | 'system'

const media =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

let currentMode: ThemeMode = 'system'

export function applyTheme(mode: unknown) {
  currentMode = mode === 'light' || mode === 'dark' ? mode : 'system'
  const resolved = currentMode === 'system' ? (media?.matches ? 'dark' : 'light') : currentMode
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
}

export async function initializeTheme() {
  applyTheme('system')
  try {
    const settings = await window.promptHub.settings.list()
    applyTheme(settings.theme_mode)
  } catch {
    // Keep the safe system default when settings cannot be read.
  }
}

media?.addEventListener('change', () => {
  if (currentMode === 'system') applyTheme('system')
})
