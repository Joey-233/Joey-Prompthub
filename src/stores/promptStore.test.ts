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

  it.each(['update-first', 'favorite-first'])('composes editor and favorite updates when %s completes', async (order) => {
    const content = deferred<PromptRecord>()
    const favorite = deferred<PromptRecord>()
    window.promptHub.prompts.update = vi.fn().mockReturnValueOnce(content.promise).mockReturnValueOnce(favorite.promise)
    const original = prompt('one', 'original')
    usePromptStore.setState({ prompts: [original] })
    const contentRequest = usePromptStore.getState().updatePrompt('one', { content: 'edited' })
    const favoriteRequest = usePromptStore.getState().toggleFavorite(original)
    const resolveContent = () => content.resolve({ ...original, content: 'edited' })
    const resolveFavorite = () => favorite.resolve({ ...original, isFavorite: true })
    if (order === 'update-first') { resolveContent(); await contentRequest; resolveFavorite(); await favoriteRequest }
    else { resolveFavorite(); await favoriteRequest; resolveContent(); await contentRequest }
    expect(usePromptStore.getState().prompts[0]).toMatchObject({ content: 'edited', isFavorite: true })
  })

  it('ignores a stale load snapshot after a local mutation succeeds', async () => {
    const load = deferred<PromptRecord[]>()
    window.promptHub.prompts.list = vi.fn().mockReturnValue(load.promise)
    window.promptHub.prompts.update = vi.fn().mockResolvedValue(prompt('one', 'edited'))
    usePromptStore.setState({ prompts: [prompt('one', 'original')] })
    const loading = usePromptStore.getState().loadPrompts()
    await usePromptStore.getState().updatePrompt('one', { content: 'edited' })
    load.resolve([prompt('one', 'stale')])
    await loading
    expect(usePromptStore.getState().prompts[0].content).toBe('edited')
  })
})
