import { describe, expect, it, vi } from 'vitest'

import type { PromptRecord } from '../shared/types'
import { usePromptStore } from './promptStore'

function prompt(id: string, content: string): PromptRecord {
  return { id, title: id, content, notes: '', tags: [], params: {}, isFavorite: false, lastUsedAt: null, lastGeneratedAt: null, useCount: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('promptStore update sequencing', () => {
  it('does not let an older response overwrite a newer response for the same prompt', async () => {
    const a = deferred<PromptRecord>()
    const b = deferred<PromptRecord>()
    window.promptHub.prompts.update = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    usePromptStore.setState({ prompts: [prompt('one', 'original')] })

    const requestA = usePromptStore.getState().updatePrompt('one', { content: 'A' })
    const requestB = usePromptStore.getState().updatePrompt('one', { content: 'B' })
    b.resolve(prompt('one', 'B'))
    await requestB
    expect(usePromptStore.getState().prompts[0].content).toBe('B')
    a.resolve(prompt('one', 'A'))
    await requestA
    expect(usePromptStore.getState().prompts[0].content).toBe('B')
  })

  it('sequences updates independently for different prompt IDs', async () => {
    const one = deferred<PromptRecord>()
    const two = deferred<PromptRecord>()
    window.promptHub.prompts.update = vi.fn().mockReturnValueOnce(one.promise).mockReturnValueOnce(two.promise)
    usePromptStore.setState({ prompts: [prompt('one', 'old one'), prompt('two', 'old two')] })
    const requestOne = usePromptStore.getState().updatePrompt('one', { content: 'new one' })
    const requestTwo = usePromptStore.getState().updatePrompt('two', { content: 'new two' })
    two.resolve(prompt('two', 'new two'))
    await requestTwo
    one.resolve(prompt('one', 'new one'))
    await requestOne
    expect(usePromptStore.getState().prompts.map(({ content }) => content)).toEqual(['new one', 'new two'])
  })

  it('keeps existing data and rejects when the latest update fails', async () => {
    const older = deferred<PromptRecord>()
    const latest = deferred<PromptRecord>()
    window.promptHub.prompts.update = vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise)
    usePromptStore.setState({ prompts: [prompt('one', 'stable')] })
    const olderRequest = usePromptStore.getState().updatePrompt('one', { content: 'older' })
    const latestRequest = usePromptStore.getState().updatePrompt('one', { content: 'lost' })
    latest.reject(new Error('offline'))
    await expect(latestRequest).rejects.toThrow('offline')
    older.resolve(prompt('one', 'older'))
    await olderRequest
    expect(usePromptStore.getState().prompts[0].content).toBe('stable')
  })
})
