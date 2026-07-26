import { gzipSync } from 'node:zlib'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const directory = join(process.cwd(), 'out', 'renderer', 'assets')
const assets = readdirSync(directory).filter((name) => /\.(?:js|css)$/.test(name))
const sizes = assets.map((name) => ({
  name,
  gzipBytes: gzipSync(readFileSync(join(directory, name))).byteLength
}))
const js = sizes.filter(({ name }) => name.endsWith('.js'))
const css = sizes.filter(({ name }) => name.endsWith('.css'))
const totalJs = js.reduce((sum, item) => sum + item.gzipBytes, 0)
const format = (bytes) => `${(bytes / 1024).toFixed(1)} KiB gzip`

const violations = []
for (const item of js) {
  if (item.gzipBytes > 190 * 1024)
    violations.push(`${item.name}: ${format(item.gzipBytes)} > 190 KiB`)
  if (item.name.startsWith('floatingBall-') && item.gzipBytes > 8 * 1024) {
    violations.push(`${item.name}: ${format(item.gzipBytes)} > 8 KiB`)
  }
}
for (const item of css) {
  if (item.gzipBytes > 20 * 1024)
    violations.push(`${item.name}: ${format(item.gzipBytes)} > 20 KiB`)
}
if (totalJs > 280 * 1024) violations.push(`all JavaScript: ${format(totalJs)} > 280 KiB`)

for (const item of sizes.sort((left, right) => right.gzipBytes - left.gzipBytes)) {
  process.stdout.write(`${item.name}: ${format(item.gzipBytes)}\n`)
}
if (violations.length) throw new Error(`Bundle budget exceeded:\n${violations.join('\n')}`)
