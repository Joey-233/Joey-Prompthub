import { appendFileSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BrowserWindow, screen, type Rectangle } from 'electron'

import type { FloatingWindowState } from '../src/shared/types'
import { getTrustedDevServerUrl, installWindowSecurity } from './windowSecurity'

const __dirname = dirname(fileURLToPath(import.meta.url))

const FLOATING_SIZE = 120 // window is larger than the visible ball (56×56) to leave room for the drop shadow
const BALL_RADIUS = 28 // visible button is 56×56, so radius is 28
const WINDOW_MARGIN = 0 // window itself can sit flush with the screen edge — transparent padding keeps the visible ball ~32px away
const DRAG_TICK_MS = 16
const HOVER_TICK_MS = 100

const DEBUG_DRAG = process.env.PROMPTHUB_DEBUG_DRAG === '1'
const DEBUG_LOG_PATH = join(tmpdir(), 'prompthub-floating-debug.log')
if (DEBUG_DRAG) {
  try {
    writeFileSync(DEBUG_LOG_PATH, `[boot] pid=${process.pid} ts=${Date.now()}\n`, 'utf8')
  } catch {
    /* ignore */
  }
}
function debugLog(label: string, payload?: unknown) {
  if (!DEBUG_DRAG) return
  try {
    const line = `[${new Date().toISOString()}] ${label} ${
      payload === undefined ? '' : JSON.stringify(payload)
    }\n`
    appendFileSync(DEBUG_LOG_PATH, line, 'utf8')
  } catch {
    /* ignore */
  }
}

export interface FloatingDragStartInput {
  /**
   * Optional cursor coordinates supplied by the renderer. Treated as a hint —
   * the main process re-reads `screen.getCursorScreenPoint()` to avoid
   * DPI / coordinate-space drift between renderer and main on Windows.
   */
  cursorScreenX?: number
  cursorScreenY?: number
}

export interface FloatingBallController {
  window: BrowserWindow
  getState: () => FloatingWindowState
  startDrag: (input: FloatingDragStartInput) => FloatingWindowState
  endDrag: (snap: boolean) => FloatingWindowState
}

export interface FloatingBallOptions {
  initialState?: Partial<FloatingWindowState>
  onStateChange?: (state: FloatingWindowState) => void
  initiallyVisible?: boolean
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function workAreaFor(point: { x: number; y: number }) {
  return screen.getDisplayNearestPoint({
    x: Math.round(point.x + FLOATING_SIZE / 2),
    y: Math.round(point.y + FLOATING_SIZE / 2)
  }).workArea
}

function clampToWorkArea(rawX: number, rawY: number) {
  const area = workAreaFor({ x: rawX, y: rawY })
  const x = clamp(
    Math.round(rawX),
    area.x + WINDOW_MARGIN,
    area.x + area.width - FLOATING_SIZE - WINDOW_MARGIN
  )
  const y = clamp(
    Math.round(rawY),
    area.y + WINDOW_MARGIN,
    area.y + area.height - FLOATING_SIZE - WINDOW_MARGIN
  )
  return { x, y, area }
}

function deriveSide(x: number, area: Rectangle): 'left' | 'right' {
  return x + FLOATING_SIZE / 2 < area.x + area.width / 2 ? 'left' : 'right'
}

function getInitialState(saved?: Partial<FloatingWindowState>): FloatingWindowState {
  if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) {
    const { x, y, area } = clampToWorkArea(Number(saved!.x), Number(saved!.y))
    return { x, y, side: deriveSide(x, area), expanded: false }
  }
  const area = screen.getPrimaryDisplay().workArea
  return {
    x: area.x + area.width - FLOATING_SIZE - WINDOW_MARGIN,
    y: area.y + Math.round((area.height - FLOATING_SIZE) / 2),
    side: 'right',
    expanded: false
  }
}

function getBounds(state: FloatingWindowState): Rectangle {
  return { x: state.x, y: state.y, width: FLOATING_SIZE, height: FLOATING_SIZE }
}

function keepAbove(window: BrowserWindow) {
  if (window.isDestroyed()) return
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
}

function loadFloatingRenderer(window: BrowserWindow) {
  const rendererUrl = getTrustedDevServerUrl()

  if (rendererUrl) {
    void window.loadURL(`${rendererUrl}/floating-ball.html`)
  } else {
    void window.loadFile(join(__dirname, '../renderer/floating-ball.html'))
  }
}

export function createFloatingBallWindow(
  options: FloatingBallOptions = {}
): FloatingBallController {
  let state = getInitialState(options.initialState)
  let dragLoop: ReturnType<typeof setInterval> | null = null
  let hoverPoll: ReturnType<typeof setInterval> | null = null
  let dragOffset: { dx: number; dy: number } | null = null
  let isDragging = false
  let isClickThrough = false

  const preloadPath = join(__dirname, '../preload/floatingPreload.js')
  debugLog('preloadResolved', { __dirname, preloadPath })

  const window = new BrowserWindow({
    ...getBounds(state),
    title: 'JoeyPrompthubFloatingBall',
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: true
    }
  })

  installWindowSecurity(window, 'floating-ball.html')

  window.webContents.on('preload-error', (_event, preload, error) => {
    debugLog('preload-error', { preload, error: error?.message })
  })

  window.webContents.on('did-fail-load', (_event, code, desc, url) => {
    debugLog('did-fail-load', { code, desc, url })
  })

  function clearDragLoop() {
    if (dragLoop) {
      clearInterval(dragLoop)
      dragLoop = null
    }
    dragOffset = null
  }

  function setClickThrough(enabled: boolean) {
    if (window.isDestroyed() || enabled === isClickThrough) return
    if (enabled) {
      window.setIgnoreMouseEvents(true, { forward: true })
    } else {
      window.setIgnoreMouseEvents(false)
    }
    isClickThrough = enabled
  }

  function isCursorInsideBall(point: { x: number; y: number }) {
    const cx = state.x + FLOATING_SIZE / 2
    const cy = state.y + FLOATING_SIZE / 2
    const dx = point.x - cx
    const dy = point.y - cy
    return dx * dx + dy * dy <= BALL_RADIUS * BALL_RADIUS
  }

  function startHoverPoll() {
    if (hoverPoll) return
    setClickThrough(true)
    hoverPoll = setInterval(() => {
      if (window.isDestroyed() || isDragging) return
      const cursor = screen.getCursorScreenPoint()
      setClickThrough(!isCursorInsideBall(cursor))
    }, HOVER_TICK_MS)
  }

  function stopHoverPoll() {
    if (hoverPoll) {
      clearInterval(hoverPoll)
      hoverPoll = null
    }
  }

  function applyState(next: FloatingWindowState) {
    state = next
    if (!window.isDestroyed()) {
      window.setBounds(getBounds(state), false)
    }
    return state
  }

  function setPositionRaw(rawX: number, rawY: number, side?: 'left' | 'right') {
    const { x, y, area } = clampToWorkArea(rawX, rawY)
    return applyState({
      x,
      y,
      side: side ?? deriveSide(x, area),
      expanded: false
    })
  }

  function startDrag(input: FloatingDragStartInput) {
    clearDragLoop()
    isDragging = true
    setClickThrough(false)

    // Anchor the drag offset to where the OS-level cursor is RIGHT NOW. This
    // avoids any DPI / coordinate-space drift between renderer events and
    // Electron's `screen` module, which is the most common cause of "the ball
    // jumps to a weird spot" or "doesn't move at all" bugs on Windows.
    const cursor = screen.getCursorScreenPoint()
    dragOffset = {
      dx: state.x - cursor.x,
      dy: state.y - cursor.y
    }

    debugLog('startDrag', {
      hint: input,
      cursor,
      windowAt: { x: state.x, y: state.y },
      offset: dragOffset
    })

    let tickCount = 0
    dragLoop = setInterval(() => {
      if (!dragOffset || window.isDestroyed()) {
        return
      }
      const point = screen.getCursorScreenPoint()
      const next = setPositionRaw(point.x + dragOffset.dx, point.y + dragOffset.dy)
      tickCount += 1
      if (DEBUG_DRAG && tickCount % 8 === 0) {
        debugLog('dragTick', { tick: tickCount, cursor: point, windowAt: { x: next.x, y: next.y } })
      }
    }, DRAG_TICK_MS)

    return state
  }

  function endDrag(_snap: boolean) {
    debugLog('endDrag', { windowAt: { x: state.x, y: state.y } })
    clearDragLoop()
    isDragging = false
    keepAbove(window)
    options.onStateChange?.(state)
    // Drop in place — no edge snapping. Let hover polling decide click-through
    // again on the next tick (the cursor is still over the ball at release).
    return state
  }

  loadFloatingRenderer(window)
  keepAbove(window)

  window.once('ready-to-show', () => {
    if (options.initiallyVisible !== false) window.showInactive()
    keepAbove(window)
    startHoverPoll()

    if (DEBUG_DRAG && process.platform === 'win32') {
      try {
        const buf = window.getNativeWindowHandle()
        const hwnd = buf.length >= 8 ? Number(buf.readBigUInt64LE(0)) : buf.readUInt32LE(0)
        const path = join(tmpdir(), 'prompthub-floating.hwnd')
        void writeFile(path, String(hwnd), 'utf8').catch(() => {})
        debugLog('hwnd', { path, hwnd })
      } catch (error) {
        debugLog('hwnd-write-failed', error)
      }
    }
  })

  window.on('show', () => keepAbove(window))
  const restoreToVisibleArea = () => {
    const next = setPositionRaw(state.x, state.y, state.side)
    options.onStateChange?.(next)
  }
  screen.on('display-added', restoreToVisibleArea)
  screen.on('display-removed', restoreToVisibleArea)
  screen.on('display-metrics-changed', restoreToVisibleArea)
  window.on('closed', () => {
    clearDragLoop()
    stopHoverPoll()
    screen.off('display-added', restoreToVisibleArea)
    screen.off('display-removed', restoreToVisibleArea)
    screen.off('display-metrics-changed', restoreToVisibleArea)
  })

  return {
    window,
    getState() {
      return state
    },
    startDrag,
    endDrag
  }
}
