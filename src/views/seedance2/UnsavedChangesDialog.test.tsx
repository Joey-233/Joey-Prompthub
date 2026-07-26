import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { UnsavedChangesDialog } from './UnsavedChangesDialog'

describe('UnsavedChangesDialog', () => {
  it('focuses cancel and treats Escape as cancel', async () => {
    const onCancel = vi.fn()
    render(
      <UnsavedChangesDialog
        saving={false}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={onCancel}
      />
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: '取消' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('disables every action while saving', () => {
    render(<UnsavedChangesDialog saving onSave={vi.fn()} onDiscard={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('保存中…')).toBeInTheDocument()
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
  })
})
