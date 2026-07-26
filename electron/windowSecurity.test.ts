import { afterEach, describe, expect, it, vi } from 'vitest'

const { openExternal } = vi.hoisted(() => ({ openExternal: vi.fn() }))

vi.mock('electron', () => ({
  shell: { openExternal }
}))

import {
  getTrustedDevServerUrl,
  installWindowSecurity,
  isTrustedRendererUrl
} from './windowSecurity'

afterEach(() => {
  delete process.env.ELECTRON_RENDERER_URL
  openExternal.mockReset()
})

describe('renderer URL trust policy', () => {
  it('accepts only renderer files from the built output directory', () => {
    expect(
      isTrustedRendererUrl(
        'file:///C:/Program%20Files/Joey/resources/app.asar/out/renderer/index.html',
        'index.html'
      )
    ).toBe(true)
    expect(isTrustedRendererUrl('file:///C:/untrusted/index.html', 'index.html')).toBe(false)
    expect(
      isTrustedRendererUrl(
        'file:///C:/Program%20Files/Joey/resources/app.asar/out/renderer/floating-ball.html',
        'index.html'
      )
    ).toBe(false)
    expect(isTrustedRendererUrl('file:///C:/bad%ZZ/out/renderer/index.html', 'index.html')).toBe(
      false
    )
  })

  it('locks development pages to the configured origin and entry path', () => {
    process.env.ELECTRON_RENDERER_URL = 'http://127.0.0.1:5173'

    expect(getTrustedDevServerUrl()).toBe('http://127.0.0.1:5173')
    expect(isTrustedRendererUrl('http://127.0.0.1:5173/', 'index.html')).toBe(true)
    expect(isTrustedRendererUrl('http://127.0.0.1:5173/index.html', 'index.html')).toBe(true)
    expect(
      isTrustedRendererUrl('http://127.0.0.1:5173/floating-ball.html', 'floating-ball.html')
    ).toBe(true)
    expect(isTrustedRendererUrl('http://127.0.0.1:9999/index.html', 'index.html')).toBe(false)
    expect(isTrustedRendererUrl('http://localhost:5173/index.html', 'index.html')).toBe(false)
    expect(isTrustedRendererUrl('http://127.0.0.1:5173/other.html', 'index.html')).toBe(false)
  })

  it('accepts IPv6 loopback but rejects remote development servers', () => {
    process.env.ELECTRON_RENDERER_URL = 'http://[::1]:5173'
    expect(getTrustedDevServerUrl()).toBe('http://[::1]:5173')

    process.env.ELECTRON_RENDERER_URL = 'https://example.com'
    expect(() => getTrustedDevServerUrl()).toThrow('仅允许本机回环地址')
  })

  it('blocks navigation and sends only HTTPS links to the system browser', () => {
    let navigateHandler:
      ((event: { preventDefault: () => void }, targetUrl: string) => void) | undefined
    let openHandler: ((details: { url: string }) => { action: string }) | undefined
    const window = {
      webContents: {
        on: vi.fn((event: string, handler: typeof navigateHandler) => {
          if (event === 'will-navigate') navigateHandler = handler
        }),
        setWindowOpenHandler: vi.fn((handler: typeof openHandler) => {
          openHandler = handler
        })
      }
    }
    installWindowSecurity(window as never, 'index.html')

    const preventDefault = vi.fn()
    navigateHandler?.({ preventDefault }, 'https://example.com/docs')
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(openExternal).toHaveBeenCalledWith('https://example.com/docs')

    expect(openHandler?.({ url: 'http://example.com' })).toEqual({ action: 'deny' })
    expect(openExternal).toHaveBeenCalledTimes(1)
  })
})
