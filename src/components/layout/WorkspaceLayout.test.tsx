import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAppStore } from '../../stores/appStore'
import { WorkspaceLayout } from './WorkspaceLayout'

function setViewport(width: number) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('1320') ? width >= 1320 : width >= 1024,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  })
}

const layout = () => (
  <WorkspaceLayout
    resource={<p>资源内容</p>}
    resourceLabel="资源"
    main={<p>主内容</p>}
    detail={<p>详情内容</p>}
    detailLabel="详情"
  />
)

describe('WorkspaceLayout', () => {
  beforeEach(() => setViewport(1400))

  it('renders three inline panes and accessible keyboard separators on desktop', async () => {
    const user = userEvent.setup()
    render(layout())

    expect(screen.getByRole('region', { name: '资源' })).toBeVisible()
    expect(screen.getByRole('region', { name: '详情' })).toBeVisible()
    const resourceSeparator = screen.getByRole('separator', { name: '调整资源面板宽度' })
    expect(resourceSeparator).toHaveAttribute('aria-orientation', 'vertical')
    expect(resourceSeparator).toHaveAttribute('aria-valuenow', '220')
    await user.type(resourceSeparator, '{arrowright}')
    expect(resourceSeparator).toHaveAttribute('aria-valuenow', '228')
    await user.type(resourceSeparator, '{end}')
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
    setViewport(1100)
    const user = userEvent.setup()
    render(layout())
    expect(screen.getByText('资源内容')).toBeVisible()
    expect(screen.queryByText('详情内容')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '打开详情面板' }))
    expect(screen.getByRole('dialog', { name: '详情' })).toHaveTextContent('详情内容')
  })

  it('uses mutually exclusive auxiliary drawers on mobile', async () => {
    setViewport(800)
    const user = userEvent.setup()
    render(layout())
    await user.click(screen.getByRole('button', { name: '打开资源面板' }))
    expect(screen.getByRole('dialog', { name: '资源' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '关闭资源面板' }))
    await user.click(screen.getByRole('button', { name: '打开详情面板' }))
    expect(screen.getByRole('dialog', { name: '详情' })).toBeVisible()
    expect(screen.queryByRole('dialog', { name: '资源' })).not.toBeInTheDocument()
  })

  it('closes a drawer with Escape and restores focus to its trigger', async () => {
    setViewport(800)
    const user = userEvent.setup()
    render(layout())
    const trigger = screen.getByRole('button', { name: '打开详情面板' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
