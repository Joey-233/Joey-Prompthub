import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { BrowserWindow } from 'electron'

import { getTrustedDevServerUrl, installWindowSecurity } from './windowSecurity'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createMainWindow() {
  const window = new BrowserWindow({
    width: 1360,
    height: 920,
    minWidth: 760,
    minHeight: 560,
    show: false,
    backgroundColor: '#f6f2e9',
    title: 'Joey Prompthub',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  installWindowSecurity(window, 'index.html')
  const rendererUrl = getTrustedDevServerUrl()

  if (rendererUrl) {
    void window.loadURL(rendererUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  window.once('ready-to-show', () => window.show())

  return window
}
