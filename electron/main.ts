import { join } from 'node:path'

import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  Menu,
  nativeImage,
  protocol,
  Tray
} from 'electron'

import { IMAGE_TAG } from '../src/shared/types'

import { createPromptDatabase, migrateLegacyDatabaseFile, type PromptDatabase } from './db'
import { createFloatingBallWindow } from './floatingBall'
import { registerIpc } from './ipc/registerIpc'
import { createMainWindow } from './mainWindow'
import { buildTrayIconPng } from './trayIcon'

const PRODUCT_NAME = 'Joey Prompthub'
const COMPATIBLE_USER_DATA_DIRECTORY = 'Prompt Hub'
const e2eUserDataDirectory =
  process.env.NODE_ENV === 'test' ? process.env.PROMPTHUB_E2E_USER_DATA : undefined
if (e2eUserDataDirectory) {
  app.setPath('userData', e2eUserDataDirectory)
} else if (app.isPackaged && process.platform === 'win32') {
  // Windows upgrades keep the original Prompt Hub storage directory so the
  // product rename does not strand prompts, assets, settings or encrypted keys.
  // A first-party macOS build uses Electron's default Joey Prompthub directory.
  app.setPath('userData', join(app.getPath('appData'), COMPATIBLE_USER_DATA_DIRECTORY))
}

// Hardware acceleration was previously disabled to work around legacy
// transparent-window glitches on Windows. On modern Electron + Win 11 it's no
// longer needed, and disabling it forces every paint through CPU which makes
// the whole app feel sluggish. If transparency glitches return on a particular
// machine, re-add `app.disableHardwareAcceleration()` here.

let mainWindow: BrowserWindow | null = null
let floatingBallWindow: ReturnType<typeof createFloatingBallWindow> | null = null
let tray: Tray | null = null
let database: PromptDatabase | null = null
let isQuitting = false

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'prompthub-asset',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false }
  }
])

function attachMainWindowCloseBehavior() {
  mainWindow?.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
}

function openMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.show()
    mainWindow.moveTop()
    mainWindow.focus()
    return
  }

  mainWindow = createMainWindow()
  attachMainWindowCloseBehavior()
}

function ensureFloatingBallWindow() {
  if (!floatingBallWindow || floatingBallWindow.window.isDestroyed()) {
    const saved = database?.settings.list()['internal.floating_position']
    floatingBallWindow = createFloatingBallWindow({
      initialState:
        saved && typeof saved === 'object'
          ? (saved as Partial<import('../src/shared/types').FloatingWindowState>)
          : undefined,
      onStateChange: (state) =>
        database?.settings.set('internal.floating_position', {
          x: state.x,
          y: state.y,
          side: state.side
        }),
      initiallyVisible: database?.settings.list().floating_enabled !== false
    })
  }
}

function showFloatingBall() {
  ensureFloatingBallWindow()
  const window = floatingBallWindow?.window
  if (window && !window.isDestroyed() && !window.isVisible()) {
    window.showInactive()
  }
}

function hideFloatingBall() {
  const window = floatingBallWindow?.window
  if (window && !window.isDestroyed() && window.isVisible()) {
    window.hide()
  }
}

function quitApp() {
  isQuitting = true
  app.quit()
}

function showFloatingContextMenu() {
  const window = floatingBallWindow?.window
  if (!window || window.isDestroyed()) return
  buildFloatingContextMenu().popup({ window })
}

function buildFloatingContextMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: '快速录入',
      click: () => openMainWindow()
    },
    {
      label: '收录剪贴板文本',
      click: () => {
        const text = clipboard.readText().trim()
        if (text && database) {
          database.prompts.create({ content: text.slice(0, 100_000), tags: [IMAGE_TAG] })
        }
        openMainWindow()
      }
    },
    { type: 'separator' },
    {
      label: '打开主面板',
      click: () => {
        openMainWindow()
      }
    },
    {
      label: '隐藏悬浮球',
      click: () => {
        hideFloatingBall()
      }
    },
    { type: 'separator' },
    {
      label: `退出 ${PRODUCT_NAME}`,
      click: () => {
        quitApp()
      }
    }
  ])
}

function buildTrayContextMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: '打开主面板',
      click: () => {
        openMainWindow()
      }
    },
    {
      label: '显示悬浮球',
      click: () => {
        showFloatingBall()
      }
    },
    { type: 'separator' },
    {
      label: `退出 ${PRODUCT_NAME}`,
      click: () => {
        quitApp()
      }
    }
  ])
}

function createTray() {
  if (tray) return
  const icon = nativeImage.createFromBuffer(buildTrayIconPng())
  tray = new Tray(icon)
  tray.setToolTip(PRODUCT_NAME)
  tray.setContextMenu(buildTrayContextMenu())
  tray.on('click', () => {
    openMainWindow()
  })
  tray.on('double-click', () => {
    openMainWindow()
  })
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    openMainWindow()
  })

  app.whenReady().then(() => {
    const dbDirectory =
      app.isPackaged || e2eUserDataDirectory ? app.getPath('userData') : process.cwd()
    migrateLegacyDatabaseFile(dbDirectory)
    database = createPromptDatabase(`${dbDirectory}/prompthub.db`)
    protocol.handle('prompthub-asset', (request) => database!.assets.handleRequest(request))
    ensureFloatingBallWindow()
    createTray()
    registerIpc({
      database,
      getMainWindow: () => mainWindow,
      getFloatingBall: () => floatingBallWindow,
      openMainWindow,
      setLaunchAtLogin: (enabled) => app.setLoginItemSettings({ openAtLogin: enabled }),
      setFloatingEnabled: (enabled) => {
        database?.settings.set('floating_enabled', enabled)
        if (enabled) showFloatingBall()
        else hideFloatingBall()
      },
      quitApp,
      showFloatingContextMenu
    })

    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      const window = floatingBallWindow?.window
      if (window?.isVisible()) hideFloatingBall()
      else showFloatingBall()
    })

    if (e2eUserDataDirectory) openMainWindow()

    app.on('activate', () => {
      ensureFloatingBallWindow()
    })
  })

  app.on('web-contents-created', (_event, contents) => {
    contents.on('render-process-gone', (_goneEvent, details) => {
      console.error('[render-process-gone]', details.reason, details.exitCode)
    })
  })

  app.on('child-process-gone', (_event, details) => {
    console.error('[child-process-gone]', details.type, details.reason, details.exitCode)
  })

  app.on('window-all-closed', () => {})

  app.on('before-quit', () => {
    isQuitting = true
    database?.close()
    globalShortcut.unregisterAll()
    if (protocol.isProtocolHandled('prompthub-asset')) protocol.unhandle('prompthub-asset')
    if (tray) {
      tray.destroy()
      tray = null
    }
  })
}
