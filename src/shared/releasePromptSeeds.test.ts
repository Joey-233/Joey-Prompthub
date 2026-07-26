import { describe, expect, it } from 'vitest'

import { RELEASE_PROMPT_SEEDS } from './releasePromptSeeds'

describe('release prompt seeds', () => {
  it('matches the four prompts selected from the development library', () => {
    expect(RELEASE_PROMPT_SEEDS.map((prompt) => prompt.title)).toEqual([
      '双城之战人物风格设定',
      '徐克风格',
      '人物脸+三视图',
      '基于此角色和背景，请制作一份类似官方设定'
    ])
    expect(RELEASE_PROMPT_SEEDS.reduce((total, prompt) => total + prompt.content.length, 0)).toBe(
      939
    )
    expect(RELEASE_PROMPT_SEEDS.at(-1)?.tags).toEqual(['GPT'])
  })
})
