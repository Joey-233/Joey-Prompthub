/* global document, window */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const websiteHtml = await readFile(join(projectRoot, 'docs', '官网主页', 'index.html'))
const downloadManifest = await readFile(
  join(projectRoot, 'docs', '官网主页', 'download-manifest.json')
)
const screenshotDirectory = process.env.WEBSITE_SCREENSHOT_DIR || tmpdir()
const githubApiUrl = 'https://api.github.com/repos/Joey-233/Joey-Prompthub/releases/latest'

const server = createServer((request, response) => {
  if (request.url === '/' || request.url === '/index.html') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(websiteHtml)
    return
  }
  if (request.url === '/download-manifest.json') {
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    })
    response.end(downloadManifest)
    return
  }
  response.writeHead(404)
  response.end()
})

await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})

const address = server.address()
if (!address || typeof address === 'string') {
  throw new Error('Website test server did not expose a TCP port.')
}
const websiteUrl = `http://127.0.0.1:${address.port}/`

const release = {
  tag_name: 'v9.8.7',
  published_at: '2026-07-27T04:00:00Z',
  assets: [
    {
      name: 'Joey Prompthub-9.8.7-Setup-x64.exe',
      size: 104857600,
      browser_download_url: 'https://example.test/windows.exe'
    },
    {
      name: 'Joey Prompthub-9.8.7-macOS-x64.dmg',
      size: 115343360,
      browser_download_url: 'https://example.test/mac-x64.dmg'
    },
    {
      name: 'Joey Prompthub-9.8.7-macOS-arm64.dmg',
      size: 110100480,
      browser_download_url: 'https://example.test/mac-arm64.dmg'
    },
    {
      name: 'Joey Prompthub-9.8.7-macOS-universal.dmg',
      size: 209715200,
      browser_download_url: 'https://example.test/mac-universal.dmg'
    }
  ]
}

const browserCandidates = [
  process.env.WEBSITE_BROWSER_PATH,
  process.env.ProgramFiles &&
    join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  process.env['ProgramFiles(x86)'] &&
    join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  chromium.executablePath()
].filter(Boolean)
const browserExecutable = browserCandidates.find((candidate) => existsSync(candidate))
if (!browserExecutable) {
  throw new Error(
    'Website visual test requires Playwright Chromium, Google Chrome or Microsoft Edge.'
  )
}
const browser = await chromium.launch({ headless: true, executablePath: browserExecutable })

async function preparePage(viewport, status, body) {
  const page = await browser.newPage({ viewport })
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort())
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort())
  await page.route(githubApiUrl, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body
    })
  )
  await page.goto(websiteUrl, { waitUntil: 'domcontentloaded' })
  return page
}

async function testReadyState(viewport, screenshotName) {
  const page = await preparePage(viewport, 200, JSON.stringify(release))
  await page.locator('#download').scrollIntoViewIfNeeded()
  await page.waitForFunction(() =>
    document.querySelector('#windows-download')?.dataset.url?.includes('windows.exe')
  )

  assert.equal(
    await page.locator('#windows-download').getAttribute('data-url'),
    'https://example.test/windows.exe'
  )
  assert.equal(
    await page.locator('#mac-download').getAttribute('data-url'),
    'https://example.test/mac-universal.dmg'
  )
  assert.match(await page.locator('#windows-download').innerText(), /下载 v9\.8\.7/)
  assert.match(await page.locator('#mac-release-size').innerText(), /Universal/)
  assert.equal(
    await page.locator('.dl-card.github a').getAttribute('href'),
    'https://github.com/Joey-233/Joey-Prompthub'
  )

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  assert.ok(horizontalOverflow <= 1, `Horizontal overflow: ${horizontalOverflow}px`)

  const screenshotPath = join(screenshotDirectory, screenshotName)
  await page.locator('#download').screenshot({ path: screenshotPath })
  await page.close()
  return screenshotPath
}

try {
  const desktopScreenshot = await testReadyState(
    { width: 1440, height: 1000 },
    'joey-download-desktop.png'
  )
  const mobileScreenshot = await testReadyState(
    { width: 390, height: 844 },
    'joey-download-mobile.png'
  )

  const noReleasePage = await preparePage({ width: 1280, height: 900 }, 404, '{}')
  await noReleasePage.waitForFunction(() =>
    document.querySelector('#windows-download')?.dataset.url?.includes('0.3.0-Setup-x64.exe')
  )
  assert.equal(await noReleasePage.locator('#windows-download').isDisabled(), false)
  assert.equal(
    await noReleasePage.locator('#windows-download').getAttribute('data-url'),
    'https://joeystudio.art/prompthub/download/Joey-Prompthub-0.3.0-Setup-x64.exe'
  )
  assert.match(
    await noReleasePage.locator('#windows-release-status').innerText(),
    /即将签名 · 开发者：Joey/
  )
  assert.equal(await noReleasePage.locator('#mac-download').isDisabled(), true)
  assert.match(
    await noReleasePage.locator('#mac-release-status').innerText(),
    /暂未包含 macOS 安装包/
  )
  await noReleasePage.locator('#download').scrollIntoViewIfNeeded()
  const manifestScreenshot = join(screenshotDirectory, 'joey-download-manifest.png')
  await noReleasePage.locator('#download').screenshot({ path: manifestScreenshot })
  await noReleasePage.close()

  console.log(
    JSON.stringify({
      desktopScreenshot,
      mobileScreenshot,
      manifestScreenshot,
      scenarios: ['github-release', 'manifest-fallback'],
      result: 'passed'
    })
  )
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
