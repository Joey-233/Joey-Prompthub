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
  document.body.innerHTML = ''
})

describe('floating ball UI', () => {
  it('opens the main window immediately on a single click', async () => {
    const bridge = api()
    const root = document.body.appendChild(document.createElement('div'))
    const cleanup = mountFloatingBall(root, bridge)
    const button = root.querySelector('button')!

    fireEvent.pointerDown(button, { button: 0, pointerId: 1, screenX: 120, screenY: 120 })
    fireEvent.pointerUp(window, { pointerId: 1, screenX: 120, screenY: 120 })
    await Promise.resolve()
    expect(bridge.openMainWindow).toHaveBeenCalledTimes(1)
    expect(bridge.showContextMenu).not.toHaveBeenCalled()
    cleanup()
  })

  it('does not open the main window after a drag', () => {
    const bridge = api()
    const root = document.body.appendChild(document.createElement('div'))
    const cleanup = mountFloatingBall(root, bridge)
    const button = root.querySelector('button')!

    fireEvent.pointerDown(button, { button: 0, pointerId: 2, screenX: 100, screenY: 100 })
    fireEvent.pointerMove(window, { pointerId: 2, screenX: 120, screenY: 100 })
    expect(button).toHaveAttribute('data-dragging', 'true')
    fireEvent.pointerUp(window, { pointerId: 2, screenX: 120, screenY: 100 })
    expect(bridge.dragEnd).toHaveBeenCalledWith(true)
    expect(bridge.openMainWindow).not.toHaveBeenCalled()
    cleanup()
  })

  it('keeps the context menu on right click and the menu keyboard key', () => {
    const bridge = api()
    const root = document.body.appendChild(document.createElement('div'))
    const cleanup = mountFloatingBall(root, bridge)
    const button = root.querySelector('button')!
    fireEvent.contextMenu(button)
    fireEvent.keyDown(button, { key: 'ContextMenu' })
    expect(bridge.showContextMenu).toHaveBeenCalledTimes(2)
    expect(bridge.openMainWindow).not.toHaveBeenCalled()
    cleanup()
  })

  it('activates the main window with Enter and Space', () => {
    const bridge = api()
    const root = document.body.appendChild(document.createElement('div'))
    const cleanup = mountFloatingBall(root, bridge)
    const button = root.querySelector('button')!
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.keyDown(button, { key: ' ' })
    expect(bridge.openMainWindow).toHaveBeenCalledTimes(2)
    expect(bridge.showContextMenu).not.toHaveBeenCalled()
    cleanup()
  })
})
