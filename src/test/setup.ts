import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'

import { useAppStore } from '../stores/appStore'
import { usePromptStore } from '../stores/promptStore'
import { useTestBenchStore } from '../stores/testBenchStore'

beforeEach(() => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('prompthub:layout')
    Object.defineProperty(window, 'promptHub', {
      configurable: true,
      value: {
        prompts: {
          list: vi.fn().mockResolvedValue([]),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn()
        },
        generations: {
          list: vi.fn().mockResolvedValue([]),
          create: vi.fn()
        },
        settings: {
          list: vi.fn().mockResolvedValue({
            image_preset: 'mock-image'
          }),
          set: vi.fn()
        },
        secure: {
          has: vi.fn().mockResolvedValue(false),
          set: vi.fn(),
          delete: vi.fn(),
          reveal: vi.fn().mockResolvedValue(null)
        },
        ai: {
          optimize: vi.fn().mockResolvedValue(''),
          describeImage: vi.fn().mockResolvedValue('')
        },
        image: {
          openaiGenerate: vi.fn().mockResolvedValue({
            providerId: 'openai-image',
            status: 'failed',
            effectiveParams: {},
            results: []
          }),
          sdWebuiGenerate: vi.fn().mockResolvedValue({
            providerId: 'sd-webui',
            status: 'failed',
            effectiveParams: {},
            results: []
          })
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
          quitApp: vi.fn(),
          getFloatingState: vi.fn().mockResolvedValue({
            x: 960,
            y: 320,
            side: 'right',
            expanded: false
          }),
          setFloatingExpanded: vi.fn().mockImplementation(async (expanded: boolean) => ({
            x: 960,
            y: 320,
            side: 'right',
            expanded
          })),
          moveFloatingWindow: vi.fn().mockImplementation(async (input: { x: number; y: number; snap?: boolean }) => ({
            x: input.x,
            y: input.y,
            side: input.x < 720 ? 'left' : 'right',
            expanded: false
          })),
          floatingDragStart: vi.fn().mockResolvedValue({
            x: 960,
            y: 320,
            side: 'right',
            expanded: false
          }),
          floatingDragEnd: vi.fn().mockResolvedValue({
            x: 960,
            y: 320,
            side: 'right',
            expanded: false
          }),
          showFloatingContextMenu: vi.fn().mockResolvedValue(undefined)
        }
      }
    })
  }

  useAppStore.setState({
    currentView: 'library',
    pendingTestBenchPromptId: null,
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
    filterTag: null,
    sortMode: 'default',
    search: '',
    selectedPromptId: null
  })
  useTestBenchStore.setState({
    prompts: [],
    selectedPromptId: null,
    draftContent: '',
    providerId: 'mock-image',
    params: { width: 512, height: 512, count: 3 },
    results: [],
    history: [],
    loading: false,
    loadingPrompts: false,
    loadingHistory: false,
    historyScope: 'current-prompt',
    saveStatus: 'idle',
    generateError: null
  })
})

afterEach(() => {
  vi.clearAllMocks()
})
