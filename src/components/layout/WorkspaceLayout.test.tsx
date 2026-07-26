import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAppStore } from '../../stores/appStore'
import { WorkspaceLayout } from './WorkspaceLayout'

function mockViewport(initialWidth: number) {
  let width = initialWidth
  const listeners = new Map<string, Set<() => void>>()
  const removeEventListener = vi.fn((event: string, listener: () => void) => {
    if (event === 'change') listeners.forEach((set) => set.delete(listener))
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const callbacks = listeners.get(query) ?? new Set<() => void>()
      listeners.set(query, callbacks)
      return {
        get matches() {
          return query.includes('1320') ? width >= 1320 : width >= 1025
        },
        media: query,
        addEventListener: (event: string, listener: () => void) => {
          if (event === 'change') callbacks.add(listener)
        },
        removeEventListener
      }
    })
  })
  return {
    setWidth(next: number) {
      width = next
      listeners.forEach((callbacks) => callbacks.forEach((callback) => callback()))
    },
    removeEventListener
  }
}

const layout = () => (
  <WorkspaceLayout
    resource={<p>资源内容</p>}
    resourceLabel="资源"
    main={<p>主内容</p>}
    detail={
      <>
        <p>详情内容</p>
        <a href="#detail-action">详情操作</a>
      </>
    }
    detailLabel="详情"
  />
)

describe('WorkspaceLayout', () => {
  beforeEach(() => mockViewport(1400))

  it('renders three inline panes and accessible keyboard separators on desktop', async () => {
    const user = userEvent.setup()
    render(layout())

    expect(screen.getByRole('region', { name: '资源' })).toBeVisible()
    expect(screen.getByRole('region', { name: '详情' })).toBeVisible()
    expect(screen.getByText('主内容').parentElement).not.toHaveStyle({ minWidth: '480px' })
    expect(screen.getByRole('region', { name: '资源' })).toHaveStyle({
      minWidth: '180px',
      flexShrink: '1'
    })
    expect(screen.getByRole('region', { name: '详情' })).toHaveStyle({
      minWidth: '280px',
      flexShrink: '1'
    })
    const resourceSeparator = screen.getByRole('separator', { name: '调整资源面板宽度' })
    expect(resourceSeparator).toHaveAttribute('aria-orientation', 'vertical')
    expect(resourceSeparator).toHaveAttribute('aria-valuenow', '220')
    resourceSeparator.focus()
    await user.keyboard('{arrowright}')
    expect(resourceSeparator).toHaveAttribute('aria-valuenow', '228')
    await user.keyboard('{end}')
    expect(resourceSeparator).toHaveAttribute('aria-valuenow', '320')
    fireEvent.doubleClick(resourceSeparator)
    expect(resourceSeparator).toHaveAttribute('aria-valuenow', '220')
  })

  it('collapses and restores inline panes through store-backed controls', async () => {
    const user = userEvent.setup()
    render(layout())
    await user.click(screen.getByRole('button', { name: '收起资源面板' }))
    expect(useAppStore.getState().layout.resourceCollapsed).toBe(true)
    expect(screen.queryByText('资源内容')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '展开资源面板' }))
    expect(screen.getByText('资源内容')).toBeVisible()
  })

  it('moves detail to a single accessible drawer on tablet', async () => {
    mockViewport(1100)
    const user = userEvent.setup()
    render(layout())
    expect(screen.getByText('资源内容')).toBeVisible()
    expect(screen.queryByText('详情内容')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '打开详情面板' }))
    expect(screen.getByRole('dialog', { name: '详情' })).toHaveTextContent('详情内容')
  })

  it('uses mutually exclusive auxiliary drawers on mobile', async () => {
    mockViewport(800)
    const user = userEvent.setup()
    render(layout())
    await user.click(screen.getByRole('button', { name: '打开资源面板' }))
    expect(screen.getByRole('dialog', { name: '资源' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '关闭资源面板' }))
    await user.click(screen.getByRole('button', { name: '打开详情面板' }))
    expect(screen.getByRole('dialog', { name: '详情' })).toBeVisible()
    expect(screen.queryByRole('dialog', { name: '资源' })).not.toBeInTheDocument()
  })

  it('treats exactly 1024px as single-main mobile and 1025px as tablet', () => {
    const viewport = mockViewport(1024)
    render(layout())
    expect(screen.queryByText('资源内容')).not.toBeInTheDocument()
    expect(screen.queryByText('详情内容')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开资源面板' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开详情面板' })).toBeInTheDocument()
    act(() => viewport.setWidth(1025))
    expect(screen.getByText('资源内容')).toBeVisible()
    expect(screen.queryByText('详情内容')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开详情面板' })).toBeInTheDocument()
  })

  it('closes a drawer with Escape and restores focus to its trigger', async () => {
    mockViewport(800)
    const user = userEvent.setup()
    render(layout())
    const trigger = screen.getByRole('button', { name: '打开详情面板' })
    await user.click(trigger)
    const close = screen.getByRole('button', { name: '关闭详情面板' })
    const action = screen.getByRole('link', { name: '详情操作' })
    expect(close).toHaveFocus()
    await user.tab()
    expect(action).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(action).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it.each(['button', 'backdrop'] as const)(
    'restores the exact trigger after closing by %s',
    async (method) => {
      mockViewport(800)
      const user = userEvent.setup()
      render(layout())
      const trigger = screen.getByRole('button', { name: '打开详情面板' })
      await user.click(trigger)
      if (method === 'button')
        await user.click(screen.getByRole('button', { name: '关闭详情面板' }))
      else fireEvent.mouseDown(screen.getByRole('dialog').parentElement!)
      await waitFor(() => expect(trigger).toHaveFocus())
    }
  )

  it('resizes both panes with pointer dragging, clamps ranges, and stops after pointer up', () => {
    render(layout())
    const resource = screen.getByRole('separator', { name: '调整资源面板宽度' })
    const detail = screen.getByRole('separator', { name: '调整详情面板宽度' })

    fireEvent.pointerDown(resource, { clientX: 100, pointerId: 1 })
    expect(document.body).toHaveStyle({ userSelect: 'none' })
    fireEvent.pointerUp(window, { pointerId: 99 })
    fireEvent.pointerMove(window, { clientX: 500, pointerId: 1 })
    expect(resource).toHaveAttribute('aria-valuenow', '320')
    fireEvent.pointerUp(window, { pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 0, pointerId: 1 })
    expect(resource).toHaveAttribute('aria-valuenow', '320')
    expect(document.body.style.userSelect).toBe('')

    fireEvent.pointerDown(detail, { clientX: 500, pointerId: 2 })
    fireEvent.pointerMove(window, { clientX: 900, pointerId: 2 })
    expect(detail).toHaveAttribute('aria-valuenow', '280')
    fireEvent.pointerMove(window, { clientX: 0, pointerId: 2 })
    expect(detail).toHaveAttribute('aria-valuenow', '480')
    fireEvent.pointerUp(window, { pointerId: 2 })
  })

  it('cleans up an active resize when unmounted', () => {
    const rendered = render(layout())
    fireEvent.pointerDown(screen.getByRole('separator', { name: '调整资源面板宽度' }), {
      clientX: 100
    })
    expect(document.body.style.userSelect).toBe('none')
    rendered.unmount()
    expect(document.body.style.userSelect).toBe('')
  })

  it.each(['pointercancel', 'lostpointercapture'] as const)(
    'cleans up resize on %s',
    (eventName) => {
      render(layout())
      const separator = screen.getByRole('separator', { name: '调整资源面板宽度' })
      Object.assign(separator, {
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
        hasPointerCapture: () => true
      })
      fireEvent.pointerDown(separator, { clientX: 100, pointerId: 7 })
      expect(separator.setPointerCapture).toHaveBeenCalledWith(7)
      if (eventName === 'pointercancel') fireEvent.pointerCancel(window, { pointerId: 7 })
      else fireEvent(separator, new Event('lostpointercapture'))
      fireEvent.pointerMove(window, { clientX: 300, pointerId: 7 })
      expect(separator).toHaveAttribute('aria-valuenow', '220')
      expect(document.body.style.userSelect).toBe('')
      expect(separator.releasePointerCapture).toHaveBeenCalledWith(7)
    }
  )

  it('stops an active resize before a breakpoint removes its separator', () => {
    const viewport = mockViewport(1400)
    render(layout())
    const separator = screen.getByRole('separator', { name: '调整资源面板宽度' })
    Object.assign(separator, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true
    })
    fireEvent.pointerDown(separator, { clientX: 100, pointerId: 8 })
    expect(separator.setPointerCapture).toHaveBeenCalledWith(8)
    act(() => viewport.setWidth(800))
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
    expect(document.body.style.userSelect).toBe('')
    fireEvent.pointerMove(window, { clientX: 300, pointerId: 8 })
    expect(useAppStore.getState().layout.resourceWidth).toBe(220)
    expect(separator.releasePointerCapture).toHaveBeenCalledWith(8)
  })

  it('reacts to breakpoint changes, closes drawers, and removes media listeners', async () => {
    const viewport = mockViewport(800)
    const user = userEvent.setup()
    const rendered = render(layout())
    await user.click(screen.getByRole('button', { name: '打开详情面板' }))
    expect(screen.getByRole('dialog', { name: '详情' })).toBeVisible()

    act(() => viewport.setWidth(1400))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: '资源' })).toBeVisible()
    expect(screen.getByRole('region', { name: '详情' })).toBeVisible()

    rendered.unmount()
    expect(viewport.removeEventListener).toHaveBeenCalledTimes(2)
  })
})
