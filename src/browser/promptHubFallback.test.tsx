import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { ensurePromptHubBridge } from './promptHubFallback'
import { Settings } from '../views/Settings'

describe('ensurePromptHubBridge', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('installs a usable fallback bridge when Electron preload is unavailable', async () => {
    Reflect.deleteProperty(window as Window & { promptHub?: unknown }, 'promptHub')

    const api = ensurePromptHubBridge()
    const created = await api.prompts.create({
      content: 'browser preview prompt',
      tags: ['绘图']
    })
    const prompts = await api.prompts.list()

    expect(window.promptHub).toBe(api)
    expect(created.title).toBeTruthy()
    expect(prompts).toHaveLength(1)
  })

  it('lets Settings render in a plain browser environment', async () => {
    Reflect.deleteProperty(window as Window & { promptHub?: unknown }, 'promptHub')
    ensurePromptHubBridge()

    render(<Settings />)

    // 重构后所有预设共用一个 ai.apiKey；UI label 改成通用「API Key」
    expect(await screen.findByLabelText('API Key')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /保存 API Key|淇濆瓨 API Key/ })).toBeInTheDocument()
  })
})
