import { expect, it, vi } from 'vitest'
import type { PromptRecord } from '../shared/types'
import { useTestBenchStore } from './testBenchStore'

const prompts: PromptRecord[] = ['a', 'b'].map((id) => ({ id, title: id.toUpperCase(), content: `prompt ${id}`, notes: '', tags: ['绘图'], params: {}, isFavorite: false, lastUsedAt: null, lastGeneratedAt: null, useCount: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' }))
const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((ok, no) => { resolve = ok; reject = no }); return { promise, resolve, reject } }

it('does not publish stale generation state into a newly selected prompt', async () => {
  const gate = deferred<null>()
  window.promptHub.generations.create = vi.fn().mockReturnValue(gate.promise)
  useTestBenchStore.setState({ prompts, selectedPromptId: 'a', draftContent: 'prompt a', providerId: 'mock-image', params: { width: 512, height: 512, count: 1 }, results: [], generateError: null })
  const pending = useTestBenchStore.getState().generate()
  await vi.waitFor(() => expect(window.promptHub.generations.create).toHaveBeenCalled())
  useTestBenchStore.getState().selectPrompt('b')
  useTestBenchStore.getState().setDraftContent('edited b')
  gate.resolve(null)
  await pending
  expect(useTestBenchStore.getState()).toMatchObject({ selectedPromptId: 'b', draftContent: 'edited b', results: [], generateError: null, loading: false })
})

it('does not publish stale save completion into a newly selected prompt', async () => {
  const gate = deferred<PromptRecord>()
  window.promptHub.prompts.update = vi.fn().mockReturnValue(gate.promise)
  useTestBenchStore.setState({ prompts, selectedPromptId: 'a', draftContent: 'edited a', saveStatus: 'idle' })
  const pending = useTestBenchStore.getState().saveDraft()
  useTestBenchStore.getState().selectPrompt('b')
  useTestBenchStore.getState().setDraftContent('edited b')
  gate.resolve({ ...prompts[0], content: 'edited a' })
  await pending
  expect(useTestBenchStore.getState()).toMatchObject({ selectedPromptId: 'b', draftContent: 'edited b', saveStatus: 'idle' })
  expect(useTestBenchStore.getState().prompts.find((prompt) => prompt.id === 'a')?.content).toBe('edited a')
})

it.each([
  ['draft', () => useTestBenchStore.getState().setDraftContent('changed')],
  ['provider', () => useTestBenchStore.getState().setProviderId('openai-image')],
  ['params', () => useTestBenchStore.getState().setParams({ count: 2 })]
])('invalidates generation immediately when %s changes', async (_name, change) => {
  const gate = deferred<null>()
  window.promptHub.generations.create = vi.fn().mockReturnValue(gate.promise)
  useTestBenchStore.setState({ prompts, selectedPromptId: 'a', draftContent: 'prompt a', providerId: 'mock-image', params: { width: 512, height: 512, count: 1 }, results: [], loading: false, generateError: 'old' })
  const pending = useTestBenchStore.getState().generate()
  await vi.waitFor(() => expect(window.promptHub.generations.create).toHaveBeenCalled())
  change()
  expect(useTestBenchStore.getState()).toMatchObject({ loading: false, generateError: null, results: [] })
  gate.resolve(null)
  await pending
  expect(useTestBenchStore.getState()).toMatchObject({ loading: false, generateError: null, results: [] })
})

it('applies only the latest overlapping save for one prompt', async () => {
  const first = deferred<PromptRecord>(); const second = deferred<PromptRecord>()
  window.promptHub.prompts.update = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  useTestBenchStore.setState({ prompts, selectedPromptId: 'a', draftContent: 'first', saveStatus: 'idle' })
  const pendingFirst = useTestBenchStore.getState().saveDraft()
  useTestBenchStore.getState().setDraftContent('second')
  const pendingSecond = useTestBenchStore.getState().saveDraft()
  second.resolve({ ...prompts[0], content: 'second' }); await pendingSecond
  first.resolve({ ...prompts[0], content: 'first' }); await pendingFirst
  expect(useTestBenchStore.getState().prompts.find((prompt) => prompt.id === 'a')?.content).toBe('second')
})

it('invalidates an active generation when restoring the same prompt snapshot', async () => {
  const gate = deferred<null>()
  window.promptHub.generations.create = vi.fn().mockReturnValue(gate.promise)
  useTestBenchStore.setState({
    prompts,
    selectedPromptId: 'a',
    draftContent: 'prompt a',
    providerId: 'mock-image',
    params: { width: 512, height: 512, count: 1 },
    history: [{ id: 'history-a', promptId: 'a', providerId: 'mock-image', status: 'mocked', promptTitleSnapshot: 'A', promptSnapshot: 'prompt a', imageData: 'old', params: {}, createdAt: '2026-01-02' }],
    results: [],
    loading: false,
    generateError: null
  })
  const pending = useTestBenchStore.getState().generate()
  await vi.waitFor(() => expect(window.promptHub.generations.create).toHaveBeenCalled())
  useTestBenchStore.getState().restoreHistoryEntry('history-a')
  expect(useTestBenchStore.getState()).toMatchObject({ selectedPromptId: 'a', draftContent: 'prompt a', loading: false, generateError: null, results: [] })
  gate.resolve(null)
  await pending
  expect(useTestBenchStore.getState()).toMatchObject({ draftContent: 'prompt a', loading: false, generateError: null, results: [] })
})
