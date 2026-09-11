import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { ensurePromptHubBridge } from './browser/promptHubFallback'
import { initializeTheme } from './shared/theme'
import { AppErrorBoundary, StartupError } from './components/ui/AppErrorBoundary'
import { usePromptStore } from './stores/promptStore'
import './index.css'

// 主进程关闭主窗口前会调用一次（见 electron/main.ts flushRendererAndDestroy）：
// 把所有未落库的编辑草稿强制保存，返回（或超时）后窗口即被销毁。
window.__prompthubBeforeClose = async () => {
  const { drafts, saveDraft } = usePromptStore.getState()
  await Promise.allSettled(Object.keys(drafts).map((id) => saveDraft(id)))
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

let startupError: unknown = null
try {
  ensurePromptHubBridge()
} catch (error) {
  startupError = error
}
void initializeTheme().catch((error) => console.error('Theme initialization failed', error))

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      {startupError ? <StartupError error={startupError} /> : <App />}
    </AppErrorBoundary>
  </StrictMode>
)
