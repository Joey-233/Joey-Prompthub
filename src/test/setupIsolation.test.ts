import { describe, expect, it } from 'vitest'

import { useAppStore } from '../stores/appStore'

describe('global app store test isolation', () => {
  it('can dirty shared layout state and persistence', () => {
    useAppStore.getState().setPaneCollapsed('resource', true)
    useAppStore.getState().setPaneWidth('detail', 450)

    expect(window.localStorage.getItem('prompthub:layout')).not.toBeNull()
  })

  it('restores exact layout defaults before the next test', () => {
    expect(useAppStore.getState().layout).toEqual({
      resourceCollapsed: false,
      detailCollapsed: false,
      resourceWidth: 220,
      detailWidth: 320
    })
    expect(window.localStorage.getItem('prompthub:layout')).toBeNull()
  })
})
