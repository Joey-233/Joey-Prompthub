import { contextBridge, ipcRenderer } from 'electron'

import type { PromptHubApi } from '../src/shared/types'

const api: PromptHubApi = {
  prompts: {
    list: (filter) => ipcRenderer.invoke('prompts:list', filter),
    create: (input) => ipcRenderer.invoke('prompts:create', input),
    update: (id, patch) => ipcRenderer.invoke('prompts:update', { id, patch }),
    delete: (id) => ipcRenderer.invoke('prompts:delete', id)
  },
  generations: {
    list: () => ipcRenderer.invoke('generations:list'),
    create: (input) => ipcRenderer.invoke('generations:create', input)
  },
  settings: {
    list: () => ipcRenderer.invoke('settings:list'),
    set: (key, value) => ipcRenderer.invoke('settings:set', { key, value })
  },
  secure: {
    has: (key) => ipcRenderer.invoke('secure:has', key),
    set: (key, value) => ipcRenderer.invoke('secure:set', { key, value }),
    delete: (key) => ipcRenderer.invoke('secure:delete', key),
    reveal: (key) => ipcRenderer.invoke('secure:reveal', key)
  },
  ai: {
    optimize: (input) => ipcRenderer.invoke('ai:optimize', input),
    describeImage: (input) => ipcRenderer.invoke('ai:describeImage', input)
  },
  image: {
    openaiGenerate: (input) => ipcRenderer.invoke('image:openaiGenerate', input),
    sdWebuiGenerate: (input) => ipcRenderer.invoke('image:sdWebuiGenerate', input)
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
    quitApp: () => ipcRenderer.invoke('system:quitApp'),
    getFloatingState: () => ipcRenderer.invoke('system:getFloatingState'),
    setFloatingExpanded: (expanded) => ipcRenderer.invoke('system:setFloatingExpanded', expanded),
    moveFloatingWindow: (input) => ipcRenderer.invoke('system:moveFloatingWindow', input),
    floatingDragStart: (input) => ipcRenderer.invoke('floating:dragStart', input),
    floatingDragEnd: (snap) => ipcRenderer.invoke('floating:dragEnd', { snap }),
    showFloatingContextMenu: () => ipcRenderer.invoke('system:showFloatingContextMenu')
  }
}

contextBridge.exposeInMainWorld('promptHub', api)
