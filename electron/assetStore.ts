import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'

const MAX_ASSET_BYTES = 16 * 1024 * 1024
const ASSET_SCHEME = 'prompthub-asset:'
const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp'
}

function parseDataUrl(value: string) {
  const match = /^data:image\/(png|jpeg|webp);base64,([a-z0-9+/=\r\n]+)$/i.exec(value)
  if (!match) throw new Error('图片数据格式不正确')
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ASSET_BYTES) {
    throw new Error('图片大小超出 16 MB 限制')
  }
  const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase()
  const validMagic =
    (extension === 'png' &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (extension === 'jpg' &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes.at(-2) === 0xff &&
      bytes.at(-1) === 0xd9) ||
    (extension === 'webp' &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP')
  if (!validMagic) throw new Error('图片内容与声明格式不一致')
  return { bytes, extension, mimeType: MIME_BY_EXTENSION[`.${extension}`] }
}

export function createAssetStore(databasePath: string) {
  const directory = join(dirname(databasePath), 'prompthub-assets')
  mkdirSync(directory, { recursive: true })

  function persist(value: string) {
    if (!value.startsWith('data:image/')) return value
    const { bytes, extension } = parseDataUrl(value)
    const hash = createHash('sha256').update(bytes).digest('hex')
    const filename = `${hash}.${extension}`
    const path = join(directory, filename)
    try {
      writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    return `${ASSET_SCHEME}//local/${filename}`
  }

  function pathForUrl(value: string) {
    const url = new URL(value)
    if (url.protocol !== ASSET_SCHEME || url.hostname !== 'local')
      throw new Error('资源地址不受信任')
    const filename = basename(decodeURIComponent(url.pathname))
    if (!/^[a-f0-9]{64}\.(?:png|jpg|webp)$/.test(filename)) throw new Error('资源名称不正确')
    return join(directory, filename)
  }

  function toDataUrl(value: string) {
    if (!value.startsWith(`${ASSET_SCHEME}//`)) return value
    const path = pathForUrl(value)
    const mimeType = MIME_BY_EXTENSION[extname(path).toLowerCase()]
    return `data:${mimeType};base64,${readFileSync(path).toString('base64')}`
  }

  function handleRequest(request: Request) {
    try {
      const path = pathForUrl(request.url)
      const bytes = readFileSync(path)
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type':
            MIME_BY_EXTENSION[extname(path).toLowerCase()] ?? 'application/octet-stream',
          'Content-Length': String(bytes.byteLength),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff'
        }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  }

  function getStats() {
    let assetCount = 0
    let assetsBytes = 0
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^[a-f0-9]{64}\.(?:png|jpg|webp)$/.test(entry.name)) continue
      assetCount += 1
      assetsBytes += statSync(join(directory, entry.name)).size
    }
    return { assetCount, assetsBytes }
  }

  function cleanup(referencedUrls: ReadonlySet<string>) {
    let removed = 0
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^[a-f0-9]{64}\.(?:png|jpg|webp)$/.test(entry.name)) continue
      const url = `${ASSET_SCHEME}//local/${entry.name}`
      if (referencedUrls.has(url)) continue
      unlinkSync(join(directory, entry.name))
      removed += 1
    }
    return removed
  }

  return { persist, toDataUrl, handleRequest, getStats, cleanup, directory }
}

export type AssetStore = ReturnType<typeof createAssetStore>
