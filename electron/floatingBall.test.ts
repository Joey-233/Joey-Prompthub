/**
 * Mocks Electron's BrowserWindow + screen so we can drive the floating-ball
 * controller end-to-end with fake timers and check that the main-process drag
 * loop actually moves the window in lockstep with the cursor and that hover
 * polling toggles click-through outside the visible ball.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const setBoundsCalls: Array<{ x: number; y: number; width: number; height: number }> = []
const ignoreCalls: Array<{ ignore: boolean; forward?: boolean }> = []

const fakeWindow = {
  setBounds: vi.fn((bounds: { x: number; y: number; width: number; height: number }) => {
    setBoundsCalls.push({ ...bounds })
  }),
  setAlwaysOnTop: vi.fn(),
  setVisibleOnAllWorkspaces: vi.fn(),
  setIgnoreMouseEvents: vi.fn(
    (ignore: boolean, options?: { forward?: boolean }) => {
      ignoreCalls.push({ ignore, forward: options?.forward })
    }
  ),
  isDestroyed: vi.fn(() => false),
  showInactive: vi.fn(),
  moveTop: vi.fn(),
  loadURL: vi.fn(() => Promise.resolve()),
  loadFile: vi.fn(() => Promise.resolve()),
  on: vi.fn(),
  once: vi.fn((event: string, handler: () => void) => {
    if (event === 'ready-to-show') {
      // Fire synchronously so the hover-poll setup runs in tests.
      handler()
    }
  }),
  webContents: { send: vi.fn(), on: vi.fn() }
}

const cursorPoint = { x: 0, y: 0 }
const workArea = { x: 0, y: 0, width: 1920, height: 1080 }

vi.mock('electron', () => ({
  BrowserWindow: function () {
    return fakeWindow
  },
  screen: {
    getCursorScreenPoint: vi.fn(() => ({ ...cursorPoint })),
    getDisplayNearestPoint: vi.fn(() => ({ workArea })),
    getPrimaryDisplay: vi.fn(() => ({ workArea }))
  }
}))

import { createFloatingBallWindow } from './floatingBall'

beforeEach(() => {
  vi.useFakeTimers()
  setBoundsCalls.length = 0
  ignoreCalls.length = 0
  fakeWindow.setBounds.mockClear()
  fakeWindow.setAlwaysOnTop.mockClear()
  fakeWindow.setVisibleOnAllWorkspaces.mockClear()
  fakeWindow.setIgnoreMouseEvents.mockClear()
  cursorPoint.x = 0
  cursorPoint.y = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('floating ball main process drag', () => {
  it('returns an initial state pinned to the right edge', () => {
    const ball = createFloatingBallWindow()
    const state = ball.getState()

    expect(state.side).toBe('right')
    // 1920 - 120 (FLOATING_SIZE) - 0 (WINDOW_MARGIN) = 1800
    expect(state.x).toBe(1800)
    expect(state.y).toBeGreaterThan(0)
  })

  it('keeps the window in lockstep with the cursor while dragging', () => {
    const ball = createFloatingBallWindow()
    const initial = ball.getState()

    cursorPoint.x = initial.x + 30
    cursorPoint.y = initial.y + 30
    ball.startDrag({ cursorScreenX: cursorPoint.x, cursorScreenY: cursorPoint.y })

    cursorPoint.x = initial.x + 30 - 200
    cursorPoint.y = initial.y + 30 + 100
    vi.advanceTimersByTime(8)

    let bounds = setBoundsCalls.at(-1)
    expect(bounds, 'setBounds should fire on the first drag tick').toBeDefined()
    expect(bounds!.x).toBe(initial.x - 200)
    expect(bounds!.y).toBe(initial.y + 100)

    cursorPoint.x += 50
    cursorPoint.y -= 20
    vi.advanceTimersByTime(8)
    bounds = setBoundsCalls.at(-1)
    expect(bounds!.x).toBe(initial.x - 150)
    expect(bounds!.y).toBe(initial.y + 80)
  })

  it('clamps the window inside the work area', () => {
    const ball = createFloatingBallWindow()
    const initial = ball.getState()

    cursorPoint.x = initial.x + 36
    cursorPoint.y = initial.y + 36
    ball.startDrag({ cursorScreenX: cursorPoint.x, cursorScreenY: cursorPoint.y })

    cursorPoint.x = -500
    cursorPoint.y = -500
    vi.advanceTimersByTime(8)

    const bounds = setBoundsCalls.at(-1)!
    expect(bounds.x).toBe(workArea.x + 0) // WINDOW_MARGIN
    expect(bounds.y).toBe(workArea.y + 0)
  })

  it('drops in place on release without snapping back to an edge', () => {
    const ball = createFloatingBallWindow()
    const initial = ball.getState()

    cursorPoint.x = initial.x + 36
    cursorPoint.y = initial.y + 36
    ball.startDrag({ cursorScreenX: cursorPoint.x, cursorScreenY: cursorPoint.y })

    // Drag past the centre vertically and toward the left half.
    cursorPoint.x = 800
    cursorPoint.y = 240
    vi.advanceTimersByTime(8)

    const droppedBounds = setBoundsCalls.at(-1)!
    const stateAfterDrag = ball.getState()
    const ticksBefore = setBoundsCalls.length

    ball.endDrag(true)

    // Even after a long quiet period, no follow-up setBounds should fire — no
    // snap animation, no edge correction.
    vi.advanceTimersByTime(400)

    expect(setBoundsCalls.length).toBe(ticksBefore)
    expect(ball.getState().x).toBe(droppedBounds.x)
    expect(ball.getState().y).toBe(droppedBounds.y)
    // Side reflects the half of the screen the ball was dropped in.
    expect(stateAfterDrag.side).toBe('left')
  })

  it('endDrag(false) freezes the ball where it is and stops polling', () => {
    const ball = createFloatingBallWindow()
    const initial = ball.getState()

    cursorPoint.x = initial.x + 36
    cursorPoint.y = initial.y + 36
    ball.startDrag({ cursorScreenX: cursorPoint.x, cursorScreenY: cursorPoint.y })

    cursorPoint.x = initial.x + 36 - 80
    cursorPoint.y = initial.y + 36 + 40
    vi.advanceTimersByTime(8)

    const finalState = ball.endDrag(false)
    const stoppedAt = setBoundsCalls.length

    cursorPoint.x = 100
    cursorPoint.y = 100
    // Don't advance long enough for the hover poll (50ms) to fire any
    // click-through toggles, since those are not setBounds anyway.
    vi.advanceTimersByTime(8)

    expect(setBoundsCalls.length).toBe(stoppedAt)
    expect(finalState.x).toBe(initial.x - 80)
  })
})

describe('floating ball click-through hover poll', () => {
  it('starts in click-through and toggles based on whether the cursor is over the ball', () => {
    const ball = createFloatingBallWindow()
    const state = ball.getState()

    // After ready-to-show fires the poll is started and click-through is on.
    expect(ignoreCalls.at(-1)).toEqual({ ignore: true, forward: true })

    // Move the cursor onto the centre of the ball (window is 120×120, ball is centered) and tick once.
    cursorPoint.x = state.x + 60
    cursorPoint.y = state.y + 60
    vi.advanceTimersByTime(50)
    expect(ignoreCalls.at(-1)).toEqual({ ignore: false, forward: undefined })

    // Move the cursor far away — click-through should re-engage.
    cursorPoint.x = 0
    cursorPoint.y = 0
    vi.advanceTimersByTime(50)
    expect(ignoreCalls.at(-1)).toEqual({ ignore: true, forward: true })
  })

  it('forces interaction during a drag (ignoreMouseEvents false) even if cursor leaves the circle', () => {
    const ball = createFloatingBallWindow()
    const state = ball.getState()

    cursorPoint.x = state.x + 60
    cursorPoint.y = state.y + 60
    ignoreCalls.length = 0

    ball.startDrag({ cursorScreenX: cursorPoint.x, cursorScreenY: cursorPoint.y })
    expect(ignoreCalls.at(-1)).toEqual({ ignore: false, forward: undefined })

    // Even if the hover poll fires while dragging, it must not flip click-through back on.
    cursorPoint.x = 0
    cursorPoint.y = 0
    vi.advanceTimersByTime(50)
    expect(ignoreCalls.at(-1)).toEqual({ ignore: false, forward: undefined })
  })
})
