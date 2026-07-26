import { contextBridge, ipcRenderer } from 'electron'

import type { PromptHubApi } from '../src/shared/types'

const api: PromptHubApi = {
  prompts: {
    list: (filter) => ipcRenderer.invoke('prompts:list', filter),
    listPage: (filter) => ipcRenderer.invoke('prompts:listPage', filter),
    get: (id) => ipcRenderer.invoke('prompts:get', id),
    create: (input) => ipcRenderer.invoke('prompts:create', input),
    update: (id, patch) => ipcRenderer.invoke('prompts:update', { id, patch }),
    delete: (id) => ipcRenderer.invoke('prompts:delete', id)
  },
  settings: {
    list: () => ipcRenderer.invoke('settings:list'),
    set: (key, value) => ipcRenderer.invoke('settings:set', { key, value })
  },
  data: {
    exportBackup: () => ipcRenderer.invoke('data:exportBackup'),
    previewImport: (backup) => ipcRenderer.invoke('data:previewImport', backup),
    importBackup: (backup, mode) => ipcRenderer.invoke('data:importBackup', { backup, mode }),
    storageStats: () => ipcRenderer.invoke('data:storageStats')
  },
  secure: {
    has: (key) => ipcRenderer.invoke('secure:has', key),
    set: (key, value) => ipcRenderer.invoke('secure:set', { key, value }),
    delete: (key) => ipcRenderer.invoke('secure:delete', key)
  },
  ai: {
    optimize: (input) => ipcRenderer.invoke('ai:optimize', input),
    describeImage: (input) => ipcRenderer.invoke('ai:describeImage', input),
    checkConnection: (kind) => ipcRenderer.invoke('ai:checkConnection', kind),
    cancelRequest: (requestId) => ipcRenderer.invoke('ai:cancelRequest', requestId)
  },
  seedance2: {
    listTemplates: () => ipcRenderer.invoke('seedance2:listTemplates'),
    createTemplate: (input) => ipcRenderer.invoke('seedance2:createTemplate', input),
    updateTemplate: (id, patch) => ipcRenderer.invoke('seedance2:updateTemplate', { id, patch }),
    deleteTemplate: (id) => ipcRenderer.invoke('seedance2:deleteTemplate', id),
    listPresets: () => ipcRenderer.invoke('seedance2:listPresets'),
    createPreset: (input) => ipcRenderer.invoke('seedance2:createPreset', input),
    updatePreset: (id, patch) => ipcRenderer.invoke('seedance2:updatePreset', { id, patch }),
    deletePreset: (id) => ipcRenderer.invoke('seedance2:deletePreset', id)
  },
  system: {
    clipboardImport: () => ipcRenderer.invoke('system:clipboardImport'),
    openMainWindow: () => ipcRenderer.invoke('system:openMainWindow'),
    setLaunchAtLogin: (enabled) => ipcRenderer.invoke('system:setLaunchAtLogin', enabled),
    setFloatingEnabled: (enabled) => ipcRenderer.invoke('system:setFloatingEnabled', enabled),
    quitApp: () => ipcRenderer.invoke('system:quitApp')
  }
}

contextBridge.exposeInMainWorld('promptHub', api)
