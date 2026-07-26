import type { PromptHubApi, PromptHubFloatingApi } from './types'

declare global {
  interface Window {
    promptHub: PromptHubApi
    promptHubFloating: PromptHubFloatingApi
  }
}

export {}
