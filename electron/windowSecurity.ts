import { shell, type BrowserWindow } from 'electron'

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
const RENDERER_DIRECTORY = '/out/renderer/'

function parseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '')
}

export function getTrustedDevServerUrl(): string | null {
  const raw = process.env.ELECTRON_RENDERER_URL
  if (!raw) return null

  const url = parseUrl(raw)
  if (
    !url ||
    !['http:', 'https:'].includes(url.protocol) ||
    !LOOPBACK_HOSTS.has(normalizeHostname(url.hostname))
  ) {
    throw new Error('ELECTRON_RENDERER_URL 仅允许本机回环地址')
  }
  return url.toString().replace(/\/$/, '')
}

export function isTrustedRendererUrl(value: string, entry: 'index.html' | 'floating-ball.html') {
  const url = parseUrl(value)
  if (!url) return false

  if (url.protocol === 'file:') {
    try {
      const pathname = decodeURIComponent(url.pathname).replace(/\\/g, '/').toLowerCase()
      return pathname.endsWith(`${RENDERER_DIRECTORY}${entry}`)
    } catch {
      return false
    }
  }

  if (!['http:', 'https:'].includes(url.protocol)) return false

  const trustedDevServer = getTrustedDevServerUrl()
  if (!trustedDevServer) return false
  const trusted = new URL(trustedDevServer)
  if (url.origin !== trusted.origin) return false

  const basePath = trusted.pathname.replace(/\/+$/, '')
  const expectedPath =
    entry === 'index.html'
      ? new Set([`${basePath}/`, `${basePath}/index.html`])
      : new Set([`${basePath}/floating-ball.html`])
  return expectedPath.has(url.pathname)
}

export function installWindowSecurity(
  window: BrowserWindow,
  entry: 'index.html' | 'floating-ball.html'
) {
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (isTrustedRendererUrl(targetUrl, entry)) return
    event.preventDefault()
    const parsed = parseUrl(targetUrl)
    if (parsed?.protocol === 'https:') {
      void shell.openExternal(parsed.toString())
    }
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    const parsed = parseUrl(url)
    if (parsed?.protocol === 'https:') {
      void shell.openExternal(parsed.toString())
    }
    return { action: 'deny' }
  })
}
