import type { PromptHubApi } from './types'

declare global {
  interface Window {
    promptHub: PromptHubApi
  }
}

export {}
