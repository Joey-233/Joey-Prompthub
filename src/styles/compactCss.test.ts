/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { findLegacyRadii } from './cssContract'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

function declarations(selector: string, source = css) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  expect(match, `missing ${selector}`).not.toBeNull()
  return match![1]
}

function mediaBlock(query: string, source = css) {
  const marker = `@media ${query}`
  const start = source.indexOf(marker)
  expect(start, `missing ${marker}`).toBeGreaterThanOrEqual(0)
  const open = source.indexOf('{', start + marker.length)
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    else if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, index)
    }
  }
  throw new Error(`unclosed ${marker}`)
}

describe('compact workspace CSS contract', () => {
  it('keeps dynamic Seedance2 section controls compact', () => {
    expect(declarations('.s2-section-controls')).toMatch(/display:\s*flex/)
    expect(declarations('.s2-section-title-input')).toMatch(/min-width:\s*0/)
    expect(declarations('.s2-add-section')).toMatch(/margin-left:\s*auto/)
  })

  it('keeps prompt detail actions fixed while its editor fields scroll', () => {
    expect(declarations('.library-detail .editor-panel')).toMatch(/display:\s*flex/)
    expect(declarations('.library-detail .editor-panel')).toMatch(/overflow:\s*hidden/)
    expect(declarations('.library-detail .editor-fields')).toMatch(/overflow-y:\s*auto/)
    expect(declarations('.library-detail .editor-actions')).toMatch(/flex:\s*none/)
  })

  it('flows prompt cards into responsive masonry columns at their natural height', () => {
    expect(declarations('.prompt-grid')).toMatch(/columns:\s*2\s+300px/)
    expect(declarations('.prompt-card')).toMatch(/display:\s*inline-grid/)
    expect(declarations('.prompt-card')).toMatch(/break-inside:\s*avoid/)
    expect(declarations('.prompt-card')).toMatch(/height:\s*auto/)
    expect(declarations('.prompt-card')).toMatch(/width:\s*100%/)
  })

  it('maintains a full-height flex chain from app content into workspaces', () => {
    expect(declarations('.app-content')).toMatch(/display:\s*flex/)
    expect(declarations('.app-content')).toMatch(/flex-direction:\s*column/)
    expect(declarations('.app-content')).toMatch(/min-height:\s*0/)
    expect(declarations('.app-content')).toMatch(/overflow:\s*hidden/)
    expect(declarations('.workspace-layout')).toMatch(/flex:\s*1/)
    expect(declarations('.test-bench-layout')).toMatch(/flex:\s*1/)
    expect(declarations('.test-bench-layout')).toMatch(/min-height:\s*0/)
    expect(declarations('.test-bench-layout')).toMatch(/width:\s*100%/)
  })

  it('lets library and test-bench empty states consume and center within their workspace', () => {
    expect(declarations('.prompt-grid:has(> .prompt-grid-empty)')).toMatch(/columns:\s*1/)
    expect(declarations('.prompt-grid-empty')).toMatch(/width:\s*100%/)
    expect(declarations('.test-bench-layout:has(> .bench-empty-state)')).toMatch(/place-items:\s*center/)
    expect(declarations('.bench-empty-state')).toMatch(/width:\s*100%/)
    expect(declarations('.bench-empty-state')).toMatch(/max-width:\s*\d+px/)
  })

  it('keeps secret status and controls compact while retaining a narrow-screen stack', () => {
    expect(declarations('.secret-actions')).toMatch(/justify-content:\s*flex-start/)
    expect(declarations('.secret-status')).toMatch(/white-space:\s*nowrap/)
    expect(declarations('.secret-controls')).toMatch(/margin-left:\s*auto/)
    const narrow = mediaBlock('(max-width: 640px)')
    expect(declarations('.secret-actions', narrow)).toMatch(/flex-direction:\s*column/)
  })

  it('isolates media queries instead of matching rules from a later block', () => {
    const sample = '@media (max-width: 640px) { .other { display: block; } } @media (max-width: 980px) { .secret-actions { flex-direction: column; } }'
    expect(mediaBlock('(max-width: 640px)', sample)).not.toContain('.secret-actions')
  })

  it('uses tokens instead of legacy 13-32px radii outside intentional image clipping', () => {
    // These are media surfaces whose slightly larger crop radius is part of the image presentation,
    // not a panel/control shape. Backdrops and circular/pill shapes do not use values in this range.
    const intentionalImageClipping = new Set([
      '.prompt-card-preview',
      '.recognize-preview',
      '.generation-preview-image'
    ])
    const violations = findLegacyRadii(css, intentionalImageClipping)

    expect(violations).toEqual([])
  })

  it.each([
    ['shorthand', '.panel { border-radius: 24px 8px; }', 24],
    ['important', '.panel { border-radius: 24px !important; }', 24],
    ['decimal', '.panel { border-radius: 13.5px; }', 13.5]
  ])('detects %s legacy radius syntax', (_name, sample, radius) => {
    expect(findLegacyRadii(sample)).toEqual([{ selector: '.panel', radius }])
  })

  it.each([
    '.placeholder-page',
    '.editor-panel',
    '.dialog-panel',
    '.bench-prompt-list',
    '.history-panel',
    '.generation-card',
    '.settings-section'
  ])('%s uses the compact panel radius token', (selector) => {
    expect(declarations(selector)).toMatch(/border-radius:\s*var\(--pv-radius-panel\)/)
  })

  it.each([
    '.editor-panel',
    '.dialog-panel',
    '.bench-prompt-list',
    '.bench-editor-panel',
    '.history-panel',
    '.settings-section'
  ])('%s keeps container padding compact', (selector) => {
    const value = declarations(selector).match(/padding:\s*([^;]+)/)?.[1].trim()
    expect(value, `${selector} needs padding`).toBeTruthy()
    if (/^\d+px$/.test(value!)) expect(Number.parseInt(value!)).toBeLessThanOrEqual(16)
    else expect(value).toMatch(/^var\(--pv-space-[23]\)$/)
  })
})
