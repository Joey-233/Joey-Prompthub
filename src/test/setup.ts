import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'

import { useAppStore } from '../stores/appStore'
import { usePromptStore } from '../stores/promptStore'

beforeEach(() => {
  if (typeof window !== 'undefined') {
    delete document.documentElement.dataset.promptHubMode
    window.localStorage.removeItem('prompthub:layout')
    Object.defineProperty(window, 'promptHub', {
      configurable: true,
      value: {
        prompts: {
          list: vi.fn().mockResolvedValue([]),
          listPage: vi.fn().mockImplementation(async (filter) => {
            const items = await window.promptHub.prompts.list(filter)
            return { items, total: items.length, hasMore: false }
          }),
          get: vi.fn().mockImplementation(async (id) => {
            const items = await window.promptHub.prompts.list()
            return items.find((item) => item.id === id) ?? null
          }),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn()
        },
        settings: {
          list: vi.fn().mockResolvedValue({}),
          set: vi.fn()
        },
        data: {
          exportBackup: vi.fn(),
          previewImport: vi.fn().mockImplementation(async (backup) => ({
            prompts: Array.isArray(backup?.prompts) ? backup.prompts.length : 0,
            generations: Array.isArray(backup?.generations) ? backup.generations.length : 0,
            templates: Array.isArray(backup?.seedance2?.templates)
              ? backup.seedance2.templates.length
              : 0,
            presets: Array.isArray(backup?.seedance2?.presets)
              ? backup.seedance2.presets.length
              : 0,
            conflicts: 0
          })),
          importBackup: vi.fn().mockImplementation(async (backup) => ({
            prompts: Array.isArray(backup?.prompts) ? backup.prompts.length : 0,
            generations: Array.isArray(backup?.generations) ? backup.generations.length : 0,
            templates: Array.isArray(backup?.seedance2?.templates)
              ? backup.seedance2.templates.length
              : 0,
            presets: Array.isArray(backup?.seedance2?.presets)
              ? backup.seedance2.presets.length
              : 0,
            conflicts: 0
          })),
          storageStats: vi
            .fn()
            .mockResolvedValue({ databaseBytes: 0, assetsBytes: 0, assetCount: 0, totalBytes: 0 })
        },
        secure: {
          has: vi.fn().mockResolvedValue(false),
          set: vi.fn(),
          delete: vi.fn()
        },
        ai: {
          optimize: vi.fn().mockResolvedValue(''),
          describeImage: vi.fn().mockResolvedValue(''),
          checkConnection: vi.fn().mockResolvedValue({ message: '连接成功', models: [] }),
          cancelRequest: vi.fn().mockResolvedValue(undefined)
        },
        seedance2: {
          listTemplates: vi.fn().mockResolvedValue([]),
          createTemplate: vi.fn(),
          updateTemplate: vi.fn(),
          deleteTemplate: vi.fn(),
          listPresets: vi.fn().mockResolvedValue([]),
          createPreset: vi.fn(),
          deletePreset: vi.fn()
        },
        system: {
          clipboardImport: vi.fn().mockResolvedValue(null),
          openMainWindow: vi.fn(),
          setLaunchAtLogin: vi.fn(),
          setFloatingEnabled: vi.fn(),
          quitApp: vi.fn()
        }
      }
    })
    Object.defineProperty(window, 'promptHubFloating', {
      configurable: true,
      value: {
        getState: vi.fn().mockResolvedValue({
          x: 960,
          y: 320,
          side: 'right',
          expanded: false
        }),
        dragStart: vi.fn().mockResolvedValue({
          x: 960,
          y: 320,
          side: 'right',
          expanded: false
        }),
        dragEnd: vi.fn().mockResolvedValue({
          x: 960,
          y: 320,
          side: 'right',
          expanded: false
        }),
        openMainWindow: vi.fn().mockResolvedValue(undefined),
        showContextMenu: vi.fn().mockResolvedValue(undefined)
      }
    })
  }

  useAppStore.setState({
    currentView: 'library',
    navigationGuard: null,
    layout: {
      resourceCollapsed: false,
      detailCollapsed: false,
      resourceWidth: 220,
      detailWidth: 320
    }
  })
  usePromptStore.setState({
    prompts: [],
    loading: false,
    error: null,
    total: 0,
    hasMore: false,
    filterTag: null,
    sortMode: 'default',
    search: '',
    selectedPromptId: null,
    selectedPrompt: null,
    loadingDetail: false,
    drafts: {}
  })
})

afterEach(() => {
  vi.clearAllMocks()
})
