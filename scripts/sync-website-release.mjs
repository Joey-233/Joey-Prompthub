import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const packagePath = join(projectRoot, 'package.json')
const websitePath = join(projectRoot, 'docs', '官网主页', 'index.html')

const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
const version = String(packageJson.version || '').trim()
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json contains an invalid version: ${version || '(empty)'}`)
}

const releaseDate =
  process.env.RELEASE_DATE ||
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
  throw new Error(`RELEASE_DATE must use YYYY-MM-DD: ${releaseDate}`)
}

const original = await readFile(websitePath, 'utf8')
let versionCount = 0
let dateCount = 0

let updated = original.replace(
  /(<(?:span|b)\b[^>]*\bdata-app-version\b[^>]*>)v?[^<]*(<\/(?:span|b)>)/g,
  (_match, opening, closing) => {
    versionCount += 1
    return `${opening}v${version}${closing}`
  }
)

updated = updated.replace(
  /(<time\b[^>]*\bdata-release-date\b[^>]*\bdatetime=")[^"]*("[^>]*>)[^<]*(<\/time>)/g,
  (_match, opening, middle, closing) => {
    dateCount += 1
    return `${opening}${releaseDate}${middle}${releaseDate}${closing}`
  }
)

if (versionCount < 2 || dateCount !== 1) {
  throw new Error(
    `Website release markers are incomplete (versions: ${versionCount}, dates: ${dateCount})`
  )
}

if (updated !== original) {
  await writeFile(websitePath, updated, 'utf8')
  console.log(`Updated website fallback release to v${version} (${releaseDate}).`)
} else {
  console.log(`Website fallback release already matches v${version} (${releaseDate}).`)
}
