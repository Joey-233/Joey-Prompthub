import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { SecretField } from './SecretField'

it('serializes save and clear operations', async () => {
  const user = userEvent.setup()
  let finishSave!: () => void
  window.promptHub.secure.has = vi.fn().mockResolvedValue(false)
  window.promptHub.secure.set = vi.fn().mockReturnValue(new Promise<void>((resolve) => { finishSave = resolve }))
  window.promptHub.secure.delete = vi.fn().mockResolvedValue(undefined)
  render(<SecretField label="API Key" storageKey="ai.apiKey" actionLabel="保存" />)
  await waitFor(() => expect(screen.getByLabelText('API Key')).toBeEnabled())
  await user.type(screen.getByLabelText('API Key'), 'secret')
  const save = screen.getByRole('button', { name: '保存' })
  await user.click(save)
  expect(save).toBeDisabled()
  expect(screen.getByLabelText('API Key')).toBeDisabled()
  await act(async () => finishSave())
  expect(await screen.findByRole('button', { name: '清除' })).toBeEnabled()
})

it('does not publish a stale initial has result after unmount', async () => {
  let finishHas!: (value: boolean) => void
  window.promptHub.secure.has = vi.fn().mockReturnValue(new Promise((resolve) => { finishHas = resolve }))
  const onConfiguredChange = vi.fn()
  const view = render(<SecretField label="API Key" storageKey="ai.apiKey" actionLabel="保存" onConfiguredChange={onConfiguredChange} />)
  expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  view.unmount()
  await act(async () => finishHas(true))
  expect(onConfiguredChange).not.toHaveBeenCalled()
})
