import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Settings } from './Settings'

describe('Settings', () => {
  it('organizes settings into accessible category, content, and help regions', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    expect(screen.getByRole('region', { name: '设置分类' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '设置内容' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '配置状态与帮助' })).toBeInTheDocument()
    const content = screen.getByRole('region', { name: '设置内容' })
    expect(within(content).getByRole('heading', { name: 'AI 服务' })).toBeInTheDocument()
    expect(within(content).queryByRole('heading', { name: '视觉模型' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '视觉模型' }))
    expect(within(content).getByRole('heading', { name: '视觉模型' })).toBeInTheDocument()
    expect(within(content).queryByRole('heading', { name: 'AI 服务' })).not.toBeInTheDocument()
  })

  it('shows a failed write beside the section and retries the exact value', async () => {
    const user = userEvent.setup()
    let rejectWrites = true
    const settingsSet = vi.fn().mockImplementation(() => rejectWrites ? Promise.reject(new Error('disk full')) : Promise.resolve())
    window.promptHub.settings.set = settingsSet
    render(<Settings />)

    const model = screen.getByLabelText('默认模型')
    fireEvent.change(model, { target: { value: 'my-model' } })
    expect(await screen.findAllByText('保存失败，点击重试')).toHaveLength(2)
    rejectWrites = false
    await user.click(within(screen.getByRole('region', { name: '设置内容' })).getByRole('button', { name: '保存失败，点击重试' }))
    expect(settingsSet).toHaveBeenLastCalledWith('ai_model', 'my-model')
    expect(await within(screen.getByRole('region', { name: '设置内容' })).findByText('已保存')).toBeInTheDocument()
  })

  it('keeps the latest write status when an older write finishes last', async () => {
    const user = userEvent.setup()
    let finishOld!: () => void
    const oldWrite = new Promise<void>((resolve) => { finishOld = resolve })
    const settingsSet = vi.fn().mockReturnValueOnce(oldWrite).mockResolvedValueOnce(undefined)
    window.promptHub.settings.set = settingsSet
    render(<Settings />)

    const model = screen.getByLabelText('默认模型')
    fireEvent.change(model, { target: { value: 'a' } })
    fireEvent.change(model, { target: { value: 'b' } })
    expect(await within(screen.getByRole('region', { name: '设置内容' })).findByText('已保存')).toBeInTheDocument()
    await act(async () => finishOld())
    expect(within(screen.getByRole('region', { name: '设置内容' })).getByText('已保存')).toBeInTheDocument()
  })

  it('does not overwrite a local edit when the initial settings load finishes later', async () => {
    const user = userEvent.setup()
    let finishLoad!: (value: Record<string, unknown>) => void
    window.promptHub.settings.list = vi.fn().mockReturnValue(new Promise((resolve) => { finishLoad = resolve }))
    render(<Settings />)

    const model = screen.getByLabelText('默认模型')
    await user.clear(model)
    await user.type(model, 'local-model')
    await act(async () => finishLoad({ ai_model: 'remote-model', theme_mode: 'dark' }))
    expect(screen.getByDisplayValue('local-model')).toBeInTheDocument()
  })

  it('checks configuration locally and reports exact missing fields', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(screen.getByRole('button', { name: '检查配置' }))
    expect(screen.getByText('缺少：API Key')).toBeInTheDocument()
    expect(window.promptHub.image.openaiGenerate).not.toHaveBeenCalled()
  })
  it('stores the unified AI API key through the secure bridge', async () => {
    const user = userEvent.setup()
    const secureSet = vi.fn().mockResolvedValue(undefined)

    window.promptHub.secure.set = secureSet

    render(<Settings />)

    // 重构后所有预设共用一个 ai.apiKey；UI label 改成通用「API Key」
    await user.type(screen.getByLabelText('API Key'), 'sk-test-key')
    await user.click(screen.getByRole('button', { name: '保存 API Key' }))

    expect(secureSet).toHaveBeenCalledWith('ai.apiKey', 'sk-test-key')
  })

  it('reports a secure reveal failure without an unhandled rejection', async () => {
    const user = userEvent.setup()
    window.promptHub.secure.has = vi.fn().mockResolvedValue(true)
    window.promptHub.secure.reveal = vi.fn().mockRejectedValue(new Error('locked'))

    render(<Settings />)

    await user.click(await screen.findByRole('button', { name: '显示' }))
    expect(await screen.findByText('读取失败，请重试')).toBeInTheDocument()
  })

  it('switching AI preset auto-fills baseURL and default model', async () => {
    const user = userEvent.setup()
    const settingsSet = vi.fn().mockResolvedValue(undefined)
    window.promptHub.settings.set = settingsSet

    render(<Settings />)

    // AI 和图像两组都用「服务商预设」做 label，AI 这组始终是第一个。
    const aiPresetSelect = screen.getAllByLabelText('服务商预设')[0] as HTMLSelectElement
    await user.selectOptions(aiPresetSelect, 'deepseek')

    expect(settingsSet).toHaveBeenCalledWith('ai_preset', 'deepseek')
    expect(settingsSet).toHaveBeenCalledWith('ai_base_url', 'https://api.deepseek.com/v1')
    expect(settingsSet).toHaveBeenCalledWith('ai_model', 'deepseek-chat')
  })

  it('switching to 自定义 keeps the existing baseURL for the user to edit', async () => {
    const user = userEvent.setup()
    const settingsSet = vi.fn().mockResolvedValue(undefined)
    window.promptHub.settings.set = settingsSet
    window.promptHub.settings.list = vi.fn().mockResolvedValue({
      ai_preset: 'openai',
      ai_base_url: 'https://api.openai.com/v1',
      ai_model: 'gpt-4.1-mini'
    })

    render(<Settings />)

    // 等首屏 settings 加载到 state
    await screen.findByDisplayValue('https://api.openai.com/v1')

    const aiPresetSelect = screen.getAllByLabelText('服务商预设')[0]
    await user.selectOptions(aiPresetSelect, 'custom')

    // 切到自定义后，主进程只写 preset，不会强制改 baseURL（用户可继续编辑）
    const baseUrlWrites = settingsSet.mock.calls.filter((call) => call[0] === 'ai_base_url')
    expect(baseUrlWrites).toHaveLength(0)
  })

  it('switching vision source to a dedicated preset seeds a vision-capable model', async () => {
    const user = userEvent.setup()
    const settingsSet = vi.fn().mockResolvedValue(undefined)
    window.promptHub.settings.set = settingsSet

    render(<Settings />)

    await user.click(screen.getByRole('button', { name: '视觉模型' }))

    await user.selectOptions(screen.getByLabelText('识图服务来源'), 'qwen')

    expect(settingsSet).toHaveBeenCalledWith('vision_preset', 'qwen')
    expect(settingsSet).toHaveBeenCalledWith(
      'vision_base_url',
      'https://dashscope.aliyuncs.com/compatible-mode/v1'
    )
    // 注意：种的是视觉模型 qwen-vl-max，而不是文本默认模型 qwen-plus
    expect(settingsSet).toHaveBeenCalledWith('vision_model', 'qwen-vl-max')
    // 独立模式下出现单独的识图 Key 输入框
    expect(screen.getByLabelText('识图 API Key（可留空）')).toBeInTheDocument()
  })

  it('vision source defaults to follow mode without a dedicated key field', async () => {
    render(<Settings />)

    await userEvent.setup().click(screen.getByRole('button', { name: '视觉模型' }))

    expect(
      (screen.getByLabelText('识图服务来源') as HTMLSelectElement).value
    ).toBe('follow')
    expect(screen.queryByLabelText('识图 API Key（可留空）')).not.toBeInTheDocument()
  })

  it('switching image preset to sd-webui keeps the user-supplied URL', async () => {
    const user = userEvent.setup()
    const settingsSet = vi.fn().mockResolvedValue(undefined)
    window.promptHub.settings.set = settingsSet
    window.promptHub.settings.list = vi.fn().mockResolvedValue({
      image_preset: 'openai-image',
      image_base_url: 'http://my-webui.local:7860'
    })

    render(<Settings />)

    await user.click(screen.getByRole('button', { name: '图像生成' }))

    await screen.findByDisplayValue('http://my-webui.local:7860')

    const selects = screen.getAllByLabelText('服务商预设')
    // 第二个「服务商预设」select 是图像服务那一组
    await user.selectOptions(selects[0], 'sd-webui')

    const baseUrlWrites = settingsSet.mock.calls.filter(
      (call) => call[0] === 'image_base_url'
    )
    // sd-webui 是 baseUrlEditable=true，不会自动覆盖用户已填值
    expect(baseUrlWrites).toHaveLength(0)
  })

  it('imports prompt metadata fields from exported json', async () => {
    const user = userEvent.setup()
    const createPrompt = vi.fn().mockResolvedValue(undefined)
    const file = new File(
      [
        JSON.stringify({
          prompts: [
            {
              title: '收藏提示词',
              type: 'image',
              content: 'cinematic portrait',
              isFavorite: true,
              lastUsedAt: '2026-04-19T08:00:00.000Z',
              lastGeneratedAt: '2026-04-19T08:10:00.000Z',
              useCount: 2
            }
          ]
        })
      ],
      'prompthub-export.json',
      { type: 'application/json' }
    )

    window.promptHub.prompts.create = createPrompt

    render(<Settings />)

    await user.click(screen.getByRole('button', { name: '数据与应用' }))

    await user.upload(screen.getByLabelText('导入 JSON 文件'), file)

    expect(createPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        // Legacy `type: 'image'` in the export forward-ports into a 绘图 tag.
        tags: ['绘图'],
        isFavorite: true,
        lastUsedAt: '2026-04-19T08:00:00.000Z',
        lastGeneratedAt: '2026-04-19T08:10:00.000Z',
        useCount: 2
      })
    )
  })
})
