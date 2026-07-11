import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Seedance2TemplateRecord } from '../shared/types'
import { useAppStore } from '../stores/appStore'
import { Seedance2 } from './Seedance2'

const data = (intro = 'intro') => ({ intro, refGroups: [], segments: [], segmentsFooter: '', style: 'style' })
const templates: Seedance2TemplateRecord[] = [
  { id: 'one', title: 'One', data: data('one'), createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'two', title: 'Two', data: data('two'), createdAt: '2026-01-01', updatedAt: '2026-01-01' }
]

function seedApi() {
  const api = window.promptHub.seedance2
  vi.mocked(api.listTemplates).mockResolvedValue(templates)
  vi.mocked(api.listPresets).mockResolvedValue([])
  vi.mocked(api.updateTemplate).mockResolvedValue(templates[0])
  return api
}

describe('Seedance2 workspace', () => {
  it('uses one workspace layout and accessible accordions', async () => {
    seedApi(); render(<Seedance2 />)
    expect(await screen.findByRole('complementary', { name: 'Seedance2 资源' })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: 'Seedance2 编辑器' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '实时预览' })).toBeInTheDocument()
    const intro = screen.getByRole('button', { name: '开篇总述', expanded: true })
    expect(intro).toHaveAttribute('aria-expanded', 'true')
    expect(intro).toHaveAttribute('aria-controls', 'seedance-section-intro')
  })

  it('guards a dirty template switch and cancel retains the draft', async () => {
    seedApi(); render(<Seedance2 />); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.type(screen.getByLabelText('开篇总述内容'), ' changed')
    await user.click(screen.getByRole('button', { name: 'Two' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存并继续' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '放弃更改' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.getByLabelText('开篇总述内容')).toHaveValue('one changed')
  })

  it('discards or saves before continuing and preserves failure for retry', async () => {
    const api = seedApi(); render(<Seedance2 />); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    await user.type(screen.getByLabelText('开篇总述内容'), '!')
    await user.click(screen.getByRole('button', { name: 'Two' }))
    await user.click(screen.getByRole('button', { name: '放弃更改' }))
    expect(screen.getByLabelText('开篇总述内容')).toHaveValue('two')

    await user.type(screen.getByLabelText('开篇总述内容'), '!')
    await user.click(screen.getByRole('button', { name: 'One' }))
    vi.mocked(api.updateTemplate).mockRejectedValueOnce(new Error('network down'))
    await user.click(screen.getByRole('button', { name: '保存并继续' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('network down')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    vi.mocked(api.updateTemplate).mockResolvedValueOnce(templates[1])
    await user.click(screen.getByRole('button', { name: '保存并继续' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.updateTemplate).toHaveBeenCalledTimes(2)
  })

  it('guards global navigation while dirty but navigates immediately when clean', async () => {
    seedApi(); render(<Seedance2 />); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'One' }))
    act(() => useAppStore.getState().setCurrentView('settings'))
    expect(useAppStore.getState().currentView).toBe('settings')
    act(() => useAppStore.getState().setCurrentView('seedance2'))
    await user.type(screen.getByLabelText('开篇总述内容'), '!')
    act(() => useAppStore.getState().setCurrentView('settings'))
    expect(useAppStore.getState().currentView).toBe('seedance2')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
