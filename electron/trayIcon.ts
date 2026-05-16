import { Buffer } from 'node:buffer'
import { deflateSync } from 'node:zlib'

const CRC32_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = (CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * Builds a 16×16 RGBA PNG suitable for `nativeImage.createFromBuffer`. Generated
 * inline so the build doesn't need to ship a binary asset alongside the JS bundle.
 */
export function buildTrayIconPng(size = 16): Buffer {
  const pixels = Buffer.alloc(size * size * 4)
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const outerR = size / 2 - 0.5
  const innerR = outerR * 0.45

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > outerR + 0.4) {
        pixels[idx + 3] = 0
      } else if (dist > innerR) {
        pixels[idx] = 0xf6
        pixels[idx + 1] = 0xcf
        pixels[idx + 2] = 0x52
        pixels[idx + 3] = 0xff
      } else {
        pixels[idx] = 0x4a
        pixels[idx + 1] = 0x2c
        pixels[idx + 2] = 0x10
        pixels[idx + 3] = 0xff
      }
    }
  }

  const stride = size * 4
  const filtered = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    filtered[y * (stride + 1)] = 0
    pixels.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const compressed = deflateSync(filtered)

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}
