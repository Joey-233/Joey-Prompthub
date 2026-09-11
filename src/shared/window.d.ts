import type { PromptHubApi, PromptHubFloatingApi } from './types'

declare global {
  interface Window {
    promptHub: PromptHubApi
    promptHubFloating: PromptHubFloatingApi
    /** 主进程关窗前调用的 flush 钩子，由 src/main.tsx 注册（见 electron/main.ts）。 */
    __prompthubBeforeClose?: () => Promise<void>
  }
}

export {}
