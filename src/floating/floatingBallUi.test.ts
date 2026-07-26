import { fireEvent } from '@testing-library/dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PromptHubFloatingApi } from '../shared/types'
import { mountFloatingBall } from './floatingBallUi'

function api(): PromptHubFloatingApi {
  const state = { x: 100, y: 100, side: 'right' as const, expanded: false }
  return {
    getState: vi.fn().mockResolvedValue(state),
    openMainWindow: vi.fn().mockResolvedValue(undefined),
    dragStart: vi.fn().mockResolvedValue(state),
    dragEnd: vi.fn().mockResolvedValue(state),
    showContextMenu: vi.fn().mockResolvedValue(undefined)
  }
}

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('floating ball UI', () => {
  it('opens the quick menu on a single click and the main window on double click', async () => {
    vi.useFakeTimers()
    const bridge = api()
    const root = document.body.appendChild(document.createElement('div'))
    const cleanup = mountFloatingBall(root, bridge)
    const button = root.querySelector('button')!

    fireEvent.pointerDown(button, { button: 0, pointerId: 1, screenX: 120, screenY: 120 })
    fireEvent.pointerUp(window, { pointerId: 1, screenX: 120, screenY: 120 })
    await vi.advanceTimersByTimeAsync(220)
    expect(bridge.showContextMenu).toHaveBeenCalledTimes(1)

    fireEvent.doubleClick(button)
    expect(bridge.openMainWindow).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('marks a drag and ends it with snapping enabled', () => {
    const bridge = api()
    const root = document.body.appendChild(document.createElement('div'))
    const cleanup = mountFloatingBall(root, bridge)
    const button = root.querySelector('button')!

    fireEvent.pointerDown(button, { button: 0, pointerId: 2, screenX: 100, screenY: 100 })
    fireEvent.pointerMove(window, { pointerId: 2, screenX: 120, screenY: 100 })
    expect(button).toHaveAttribute('data-dragging', 'true')
    fireEvent.pointerUp(window, { pointerId: 2, screenX: 120, screenY: 100 })
    expect(bridge.dragEnd).toHaveBeenCalledWith(true)
    cleanup()
  })

  it('supports keyboard and context-menu access', () => {
    const bridge = api()
    const root = document.body.appendChild(document.createElement('div'))
    const cleanup = mountFloatingBall(root, bridge)
    const button = root.querySelector('button')!
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.contextMenu(button)
    expect(bridge.showContextMenu).toHaveBeenCalledTimes(2)
    cleanup()
  })
})
