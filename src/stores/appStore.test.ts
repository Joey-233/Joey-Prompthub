import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'prompthub:layout'

async function loadStore() {
  const { useAppStore } = await import('./appStore')
  return useAppStore
}

describe('appStore layout preferences', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('restores saved layout preferences', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        resourceCollapsed: true,
        detailCollapsed: true,
        resourceWidth: 260,
        detailWidth: 400
      })
    )

    const store = await loadStore()

    expect(store.getState().layout).toEqual({
      resourceCollapsed: true,
      detailCollapsed: true,
      resourceWidth: 260,
      detailWidth: 400
    })
  })

  it('falls back safely when saved JSON is malformed', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{invalid')

    const store = await loadStore()

    expect(store.getState().layout).toEqual({
      resourceCollapsed: false,
      detailCollapsed: false,
      resourceWidth: 220,
      detailWidth: 320
    })
  })

  it('validates restored fields and clamps saved widths', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        resourceCollapsed: 'yes',
        detailCollapsed: true,
        resourceWidth: 120,
        detailWidth: 900
      })
    )

    const store = await loadStore()

    expect(store.getState().layout).toEqual({
      resourceCollapsed: false,
      detailCollapsed: true,
      resourceWidth: 180,
      detailWidth: 480
    })
  })

  it('clamps width updates and persists layout changes', async () => {
    const store = await loadStore()

    store.getState().setPaneCollapsed('resource', true)
    store.getState().setPaneWidth('resource', 999)
    store.getState().setPaneWidth('detail', 100)

    expect(store.getState().layout).toEqual({
      resourceCollapsed: true,
      detailCollapsed: false,
      resourceWidth: 320,
      detailWidth: 280
    })
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual(
      store.getState().layout
    )
  })

  it('ignores non-finite width updates', async () => {
    const store = await loadStore()
    const initialLayout = store.getState().layout
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')

    try {
      store.getState().setPaneWidth('resource', Number.NaN)
      store.getState().setPaneWidth('detail', Number.POSITIVE_INFINITY)

      expect(store.getState().layout).toBe(initialLayout)
      expect(listener).not.toHaveBeenCalled()
      expect(storageSpy).not.toHaveBeenCalled()
    } finally {
      unsubscribe()
      storageSpy.mockRestore()
    }
  })

  it('does not leak a mocked storage method between tests', () => {
    expect(vi.isMockFunction(Storage.prototype.setItem)).toBe(false)
  })

  it('resets and persists only layout without changing navigation state', async () => {
    const store = await loadStore()
    store.getState().openTestBench('prompt-1')
    store.getState().setPaneCollapsed('detail', true)
    store.getState().setPaneWidth('detail', 450)

    store.getState().resetLayout()

    expect(store.getState().layout).toEqual({
      resourceCollapsed: false,
      detailCollapsed: false,
      resourceWidth: 220,
      detailWidth: 320
    })
    expect(store.getState().currentView).toBe('test-bench')
    expect(store.getState().pendingTestBenchPromptId).toBe('prompt-1')
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual(
      store.getState().layout
    )
  })
})
