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
