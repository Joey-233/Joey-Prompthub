/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

function declarations(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  expect(match, `missing ${selector}`).not.toBeNull()
  return match![1]
}

describe('compact workspace CSS contract', () => {
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
