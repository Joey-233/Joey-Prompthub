import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearSeedance2Session,
  readSeedance2Session,
  saveSeedance2Session,
  type Seedance2SessionState
} from './session'

const validSession: Seedance2SessionState = {
  currentId: 'tpl-1',
  title: '未命名模板',
  draft: { sections: [{ id: 'intro', title: '开篇总述', kind: 'text', content: 'hello' }] },
  activeSectionId: 'intro'
}

beforeEach(() => {
  localStorage.clear()
})

describe('seedance2 session persistence', () => {
  it('round-trips a dirty session', () => {
    saveSeedance2Session(validSession)
    expect(readSeedance2Session()).toEqual(validSession)
  })

  it('reads are pure — repeated reads return the same session', () => {
    saveSeedance2Session(validSession)
    expect(readSeedance2Session()).toEqual(validSession)
    expect(readSeedance2Session()).toEqual(validSession)
  })

  it('returns null for malformed payloads instead of throwing', () => {
    localStorage.setItem('prompthub.seedance2.session.v1', '{not json')
    expect(readSeedance2Session()).toBeNull()

    localStorage.setItem('prompthub.seedance2.session.v1', JSON.stringify({ title: 42 }))
    expect(readSeedance2Session()).toBeNull()

    localStorage.setItem(
      'prompthub.seedance2.session.v1',
      JSON.stringify({ ...validSession, draft: { sections: 'nope' } })
    )
    expect(readSeedance2Session()).toBeNull()
  })

  it('normalizes legacy draft shapes on restore', () => {
    localStorage.setItem(
      'prompthub.seedance2.session.v1',
      JSON.stringify({ ...validSession, draft: { sections: [] } })
    )
    const session = readSeedance2Session()
    expect(session).not.toBeNull()
    expect(Array.isArray(session!.draft.sections)).toBe(true)
  })

  it('keeps null currentId / activeSectionId for unsaved new templates', () => {
    saveSeedance2Session({ ...validSession, currentId: null, activeSectionId: null })
    const session = readSeedance2Session()
    expect(session?.currentId).toBeNull()
    expect(session?.activeSectionId).toBeNull()
  })

  it('clear removes the stored session', () => {
    saveSeedance2Session(validSession)
    clearSeedance2Session()
    expect(readSeedance2Session()).toBeNull()
  })
})
