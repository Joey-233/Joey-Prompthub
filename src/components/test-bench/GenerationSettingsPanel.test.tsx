import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { GenerationSettingsPanel } from './GenerationSettingsPanel'

it('clamps count to provider batch limits', async () => {
  const onParamsChange = vi.fn()
  render(<GenerationSettingsPanel content="prompt" loading={false} providerId="mock-image" params={{ width: 512, height: 512, count: 3 }} onProviderChange={vi.fn()} onParamsChange={onParamsChange} onGenerate={vi.fn()} />)
  const count = screen.getByRole('spinbutton', { name: '数量' })
  fireEvent.change(count, { target: { value: '99' } })
  expect(onParamsChange).toHaveBeenLastCalledWith({ count: 4 })
  fireEvent.change(count, { target: { value: '0' } })
  expect(onParamsChange).toHaveBeenLastCalledWith({ count: 1 })
})

it('clamps steps to provider capability limits', () => {
  const onParamsChange = vi.fn()
  render(<GenerationSettingsPanel content="prompt" loading={false} providerId="sd-webui" params={{ width: 512, height: 512, steps: 20, count: 1 }} onProviderChange={vi.fn()} onParamsChange={onParamsChange} onGenerate={vi.fn()} />)
  const steps = screen.getByRole('spinbutton', { name: '步数' })
  fireEvent.change(steps, { target: { value: '999' } })
  expect(onParamsChange).toHaveBeenLastCalledWith({ steps: 100 })
  fireEvent.change(steps, { target: { value: '0' } })
  expect(onParamsChange).toHaveBeenLastCalledWith({ steps: 1 })
})
