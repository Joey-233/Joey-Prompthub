import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Settings } from './Settings'

describe('Settings', () => {
  it('shows only the unified OpenAI-compatible text API configuration', () => {
    render(<Settings />)

    expect(screen.getByRole('main', { name: '文字 API 设置' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '文字 API' })).toBeInTheDocument()
    expect(screen.getByLabelText('服务商预设')).toBeInTheDocument()
    expect(screen.getByLabelText('API Base URL')).toBeInTheDocument()
    expect(screen.getByLabelText('模型')).toBeInTheDocument()
    expect(screen.getByLabelText('API Key')).toBeInTheDocument()
    expect(screen.queryByText('视觉模型')).not.toBeInTheDocument()
    expect(screen.queryByText('图像生成')).not.toBeInTheDocument()
    expect(screen.queryByText('数据与应用')).not.toBeInTheDocument()
  })

  it('offers only Doubao, DeepSeek, and custom OpenAI-compatible presets', () => {
    render(<Settings />)

    const options = [...screen.getByLabelText('服务商预设').querySelectorAll('option')].map(
      (option) => [option.value, option.textContent]
    )
    expect(options).toEqual([
      ['doubao', '豆包（火山方舟）'],
      ['deepseek', 'DeepSeek'],
      ['custom', '自定义（OpenAI 兼容）']
    ])
  })

  it('defaults to the official Doubao URL and exposes current model shortcuts', () => {
    render(<Settings />)

    expect(screen.getByDisplayValue('https://ark.cn-beijing.volces.com/api/v3')).toHaveAttribute(
      'readonly'
    )
    expect(screen.getByRole('button', { name: 'doubao-seed-evolving' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'doubao-seed-2.1-pro' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'doubao-seed-2.1-turbo' })).toBeInTheDocument()
  })

  it('switching to DeepSeek saves its official URL and current V4 default', async () => {
    const settingsSet = vi.fn().mockResolvedValue(undefined)
    window.promptHub.settings.set = settingsSet
    render(<Settings />)

    await userEvent.setup().selectOptions(screen.getByLabelText('服务商预设'), 'deepseek')

    expect(settingsSet).toHaveBeenCalledWith('ai_preset', 'deepseek')
    expect(settingsSet).toHaveBeenCalledWith('ai_base_url', 'https://api.deepseek.com')
    expect(settingsSet).toHaveBeenCalledWith('ai_model', 'deepseek-v4-flash')
    expect(screen.getByRole('button', { name: 'deepseek-v4-pro' })).toBeInTheDocument()
  })

  it('stores only the user-entered API key through secure local storage', async () => {
    const secureSet = vi.fn().mockResolvedValue(undefined)
    window.promptHub.secure.set = secureSet
    render(<Settings />)

    await waitFor(() => expect(screen.getByLabelText('API Key')).toBeEnabled())
    await userEvent.setup().type(screen.getByLabelText('API Key'), 'user-owned-key')
    await userEvent.setup().click(screen.getByRole('button', { name: '保存 API Key' }))

    expect(secureSet).toHaveBeenCalledWith('ai.apiKey', 'user-owned-key')
  })

  it('checks required fields locally before making a connection request', async () => {
    render(<Settings />)

    await userEvent.setup().click(screen.getByRole('button', { name: '检查连接' }))

    expect(screen.getByText('缺少：API Key')).toBeInTheDocument()
    expect(window.promptHub.ai.checkConnection).not.toHaveBeenCalled()
  })

  it('maps a hidden legacy provider to custom without overwriting its URL or model', async () => {
    window.promptHub.settings.list = vi.fn().mockResolvedValue({
      ai_preset: 'openai',
      ai_base_url: 'https://legacy.example/v1',
      ai_model: 'legacy-model'
    })
    render(<Settings />)

    expect(await screen.findByDisplayValue('https://legacy.example/v1')).not.toHaveAttribute(
      'readonly'
    )
    expect(screen.getByDisplayValue('legacy-model')).toBeInTheDocument()
    expect(screen.getByLabelText('服务商预设')).toHaveValue('custom')
    expect(window.promptHub.settings.set).not.toHaveBeenCalled()
  })

  it('shows a failed write and retries the exact latest value', async () => {
    let rejectWrites = true
    const settingsSet = vi
      .fn()
      .mockImplementation(() =>
        rejectWrites ? Promise.reject(new Error('disk full')) : Promise.resolve()
      )
    window.promptHub.settings.set = settingsSet
    render(<Settings />)

    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'my-model' } })
    const retry = await screen.findByRole('button', { name: '保存失败，点击重试' })
    rejectWrites = false
    await userEvent.setup().click(retry)

    expect(settingsSet).toHaveBeenLastCalledWith('ai_model', 'my-model')
    expect(await screen.findByText('已保存')).toBeInTheDocument()
  })

  it('keeps the latest write status when an older write finishes last', async () => {
    let finishOld!: () => void
    const oldWrite = new Promise<void>((resolve) => {
      finishOld = resolve
    })
    window.promptHub.settings.set = vi
      .fn()
      .mockReturnValueOnce(oldWrite)
      .mockResolvedValueOnce(undefined)
    render(<Settings />)

    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'first' } })
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'second' } })
    expect(screen.getByText('保存中…')).toBeInTheDocument()
    await act(async () => finishOld())

    expect(await screen.findByText('已保存')).toBeInTheDocument()
  })
})
