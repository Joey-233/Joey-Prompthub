import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'

import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from 'electron'

import { createPromptDatabase } from './db'
import { createFloatingBallWindow } from './floatingBall'
import { registerIpc } from './ipc/registerIpc'
import { createMainWindow } from './mainWindow'
import { buildTrayIconPng } from './trayIcon'

// Hardware acceleration was previously disabled to work around legacy
// transparent-window glitches on Windows. On modern Electron + Win 11 it's no
// longer needed, and disabling it forces every paint through CPU which makes
// the whole app feel sluggish. If transparency glitches return on a particular
// machine, re-add `app.disableHardwareAcceleration()` here.

/**
 * Prompt Hub 之前叫 PromptVault，老用户的本地数据库文件名是 promptvault.db。
 * 启动时若新名字 (prompthub.db) 不存在但老名字存在，就把整个 SQLite triplet
 * (.db / .db-shm / .db-wal) 一起搬过来，保留全部历史数据。
 */
function migrateLegacyDbName(directory: string) {
  const oldBase = join(directory, 'promptvault.db')
  const newBase = join(directory, 'prompthub.db')
  if (existsSync(newBase) || !existsSync(oldBase)) {
    return
  }
  for (const suffix of ['', '-shm', '-wal']) {
    const oldPath = oldBase + suffix
    const newPath = newBase + suffix
    if (existsSync(oldPath) && !existsSync(newPath)) {
      try {
        renameSync(oldPath, newPath)
      } catch (error) {
        console.warn(`[migrateLegacyDbName] 跳过 ${oldPath}:`, error)
      }
    }
  }
}

const dbDirectory = app.isPackaged ? app.getPath('userData') : process.cwd()
migrateLegacyDbName(dbDirectory)

const database = createPromptDatabase(
  app.isPackaged ? `${app.getPath('userData')}/prompthub.db` : 'prompthub.db'
)

let mainWindow: BrowserWindow | null = null
let floatingBallWindow: ReturnType<typeof createFloatingBallWindow> | null = null
let tray: Tray | null = null
let isQuitting = false

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
    floatingBallWindow = createFloatingBallWindow()
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

function buildFloatingContextMenu(): Menu {
  return Menu.buildFromTemplate([
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
      label: '退出 Prompt Hub',
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
      label: '退出 Prompt Hub',
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
  tray.setToolTip('Prompt Hub')
  tray.setContextMenu(buildTrayContextMenu())
  tray.on('click', () => {
    openMainWindow()
  })
  tray.on('double-click', () => {
    openMainWindow()
  })
}

app.whenReady().then(() => {
  ensureFloatingBallWindow()
  createTray()
  registerIpc(database, openMainWindow, () => floatingBallWindow)

  ipcMain.handle('system:setLaunchAtLogin', (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled })
  })

  ipcMain.handle('system:quitApp', () => {
    quitApp()
  })

  ipcMain.handle('system:showFloatingContextMenu', () => {
    const window = floatingBallWindow?.window
    if (!window || window.isDestroyed()) {
      return
    }
    buildFloatingContextMenu().popup({ window })
  })

  app.on('activate', () => {
    ensureFloatingBallWindow()
  })
})

app.on('window-all-closed', () => {})

app.on('before-quit', () => {
  isQuitting = true
  database.close()
  if (tray) {
    tray.destroy()
    tray = null
  }
})
