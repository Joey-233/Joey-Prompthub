import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App shell', () => {
  it('renders the three current destinations and removes the test bench', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('button', { name: '提示词库' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('button', { name: '测试台' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seedance2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '提示词库', level: 1 })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '设置' }))
    expect(screen.getByRole('button', { name: '设置' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: '设置', level: 1 })).toBeInTheDocument()
  })

  it('associates every compact navigation button with its full text tooltip', () => {
    render(<App />)

    for (const label of ['提示词库', 'Seedance2', '设置']) {
      const button = screen.getByRole('button', { name: label })
      const tooltipId = button.getAttribute('aria-describedby')
      expect(tooltipId).toBeTruthy()
      expect(document.getElementById(tooltipId!)).toHaveTextContent(label)
      expect(document.getElementById(tooltipId!)).toHaveAttribute('role', 'tooltip')
    }
  })
})
