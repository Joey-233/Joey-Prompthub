import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { ensurePromptHubBridge } from './browser/promptHubFallback'
import { initializeTheme } from './shared/theme'
import { AppErrorBoundary, StartupError } from './components/ui/AppErrorBoundary'
import './index.css'

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
