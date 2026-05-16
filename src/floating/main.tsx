import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ensurePromptHubBridge } from '../browser/promptHubFallback'
import { FloatingBallApp } from './FloatingBallApp'
import '../index.css'

const rootElement = document.getElementById('floating-root')

if (!rootElement) {
  throw new Error('Floating root element not found')
}

ensurePromptHubBridge()

createRoot(rootElement).render(
  <StrictMode>
    <FloatingBallApp />
  </StrictMode>
)
