import { contextBridge, ipcRenderer } from 'electron'

import type { PromptHubFloatingApi } from '../src/shared/types'

const api: PromptHubFloatingApi = {
  getState: () => ipcRenderer.invoke('system:getFloatingState'),
  openMainWindow: () => ipcRenderer.invoke('floating:openMainWindow'),
  dragStart: (input) => ipcRenderer.invoke('floating:dragStart', input),
  dragEnd: (snap) => ipcRenderer.invoke('floating:dragEnd', { snap }),
  showContextMenu: () => ipcRenderer.invoke('system:showFloatingContextMenu')
}

contextBridge.exposeInMainWorld('promptHubFloating', api)
