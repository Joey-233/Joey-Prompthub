import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { ensurePromptHubBridge } from './browser/promptHubFallback'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

ensurePromptHubBridge()

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
