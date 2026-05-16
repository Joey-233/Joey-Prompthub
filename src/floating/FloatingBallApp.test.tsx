import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FloatingBallApp } from './FloatingBallApp'

describe('FloatingBallApp', () => {
  it('opens the main window on click instead of rendering an internal panel', async () => {
    const openMainWindow = vi.fn().mockResolvedValue(undefined)
    const showFloatingContextMenu = vi.fn().mockResolvedValue(undefined)
    const floatingDragStart = vi.fn().mockResolvedValue({
      x: 1180,
      y: 400,
      side: 'right',
      expanded: false
    })
    const floatingDragEnd = vi.fn().mockResolvedValue({
      x: 1180,
      y: 400,
      side: 'right',
      expanded: false
    })
    window.promptHub.system.openMainWindow = openMainWindow
    window.promptHub.system.showFloatingContextMenu = showFloatingContextMenu
    window.promptHub.system.floatingDragStart = floatingDragStart
    window.promptHub.system.floatingDragEnd = floatingDragEnd

    render(<FloatingBallApp />)

    fireEvent.pointerDown(screen.getByRole('button', { name: '打开菜单' }), {
      button: 0,
      pointerId: 1,
      screenX: 1200,
      screenY: 420
    })
    fireEvent.pointerUp(window, { pointerId: 1, screenX: 1200, screenY: 420 })

    await waitFor(() => expect(openMainWindow).toHaveBeenCalled())
    expect(floatingDragEnd).toHaveBeenCalledWith(false)
    expect(showFloatingContextMenu).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '快速录入' })).not.toBeInTheDocument()
  })

  it('starts a drag on the main process and snaps on release', async () => {
    const floatingDragStart = vi.fn().mockResolvedValue({
      x: 1180,
      y: 400,
      side: 'right',
      expanded: false
    })
    const floatingDragEnd = vi.fn().mockResolvedValue({
      x: 1252,
      y: 408,
      side: 'right',
      expanded: false
    })
    const showFloatingContextMenu = vi.fn().mockResolvedValue(undefined)
    const openMainWindow = vi.fn().mockResolvedValue(undefined)

    window.promptHub.system.getFloatingState = vi.fn().mockResolvedValue({
      x: 1180,
      y: 400,
      side: 'right',
      expanded: false
    })
    window.promptHub.system.floatingDragStart = floatingDragStart
    window.promptHub.system.floatingDragEnd = floatingDragEnd
    window.promptHub.system.openMainWindow = openMainWindow
    window.promptHub.system.showFloatingContextMenu = showFloatingContextMenu

    render(<FloatingBallApp />)

    await waitFor(() => expect(window.promptHub.system.getFloatingState).toHaveBeenCalled())

    const trigger = screen.getByRole('button', { name: '打开菜单' })
    fireEvent.pointerDown(trigger, { button: 0, pointerId: 1, screenX: 1200, screenY: 420 })
    fireEvent.pointerMove(window, { pointerId: 1, screenX: 1240, screenY: 430 })
    fireEvent.pointerUp(window, { pointerId: 1, screenX: 1240, screenY: 430 })

    await waitFor(() => {
      expect(floatingDragStart).toHaveBeenCalledWith({
        cursorScreenX: 1200,
        cursorScreenY: 420
      })
      expect(floatingDragEnd).toHaveBeenCalledWith(true)
    })
    expect(showFloatingContextMenu).not.toHaveBeenCalled()
    expect(openMainWindow).not.toHaveBeenCalled()
  })

  it('asks the main process for the floating context menu on right-click', () => {
    const openMainWindow = vi.fn().mockResolvedValue(undefined)
    const showFloatingContextMenu = vi.fn().mockResolvedValue(undefined)
    window.promptHub.system.openMainWindow = openMainWindow
    window.promptHub.system.showFloatingContextMenu = showFloatingContextMenu

    render(<FloatingBallApp />)

    fireEvent.contextMenu(screen.getByRole('button', { name: '打开菜单' }))

    expect(showFloatingContextMenu).toHaveBeenCalled()
    expect(openMainWindow).not.toHaveBeenCalled()
  })
})
