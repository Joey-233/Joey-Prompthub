import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Locator,
  type Page
} from '@playwright/test'
import axe from 'axe-core'

let app: ElectronApplication
let page: Page
let userDataDirectory: string

function isMainWindow(candidate: Page) {
  return /\/index\.html(?:[?#].*)?$/.test(candidate.url())
}

async function revealResponsiveContent(label: '打开资源面板' | '打开详情面板', content: Locator) {
  const trigger = page.getByRole('button', { name: label })
  await expect(content.or(trigger)).toBeVisible()
  if (await trigger.isVisible()) {
    await trigger.click()
    await expect(content).toBeVisible()
    return true
  }
  return false
}

test.beforeEach(async () => {
  userDataDirectory = mkdtempSync(join(tmpdir(), 'prompthub-e2e-'))
  const executablePath = process.env.PROMPTHUB_E2E_EXECUTABLE
  app = await electron.launch({
    ...(executablePath ? { executablePath, args: [] } : { args: ['.'], cwd: process.cwd() }),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PROMPTHUB_E2E_USER_DATA: userDataDirectory
    }
  })
  const existingMainWindow = app.windows().find(isMainWindow)
  if (existingMainWindow) {
    page = existingMainWindow
  } else {
    const floatingWindow = await app.firstWindow()
    const mainWindowPromise = app.waitForEvent('window', { predicate: isMainWindow })
    await floatingWindow.getByRole('button').dblclick()
    page = await mainWindowPromise
  }
  if (process.env.CI) await page.setViewportSize({ width: 1008, height: 681 })
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await expect(page.getByRole('heading', { name: '提示词库', level: 1 })).toBeVisible()
})

test.afterEach(async () => {
  await app.close()
  rmSync(userDataDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
})

test('launches, navigates, and has no serious accessibility violations', async () => {
  await expect(page).toHaveTitle('Joey Prompthub')
  await page.getByRole('button', { name: '设置' }).click()
  await expect(page.getByRole('heading', { name: '设置', level: 1 })).toBeVisible()
  await page.evaluate(axe.source)
  const results = await page.evaluate(() =>
    (window as typeof window & { axe: typeof import('axe-core') }).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }
    })
  )
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    )
  ).toEqual([])
})

test('creates, edits, favorites, and deletes a prompt through the real database', async () => {
  const initialPromptCount = await page.evaluate(
    async () => (await window.promptHub.prompts.list()).length
  )
  const original = 'E2E 发行前提示词'
  await page.getByRole('textbox', { name: '快速录入' }).fill(original)
  await page.getByRole('textbox', { name: '快速录入' }).press('Control+Enter')

  await page.getByRole('button', { name: original, exact: true }).click()
  const detailHeading = page.getByRole('heading', { name: '提示词详情' })
  await revealResponsiveContent('打开详情面板', detailHeading)
  await expect(detailHeading).toBeVisible()
  await page.getByRole('textbox', { name: '标题' }).fill('E2E 已编辑标题')
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const prompts = await window.promptHub.prompts.list()
        return prompts[0]?.title
      })
    )
    .toBe('E2E 已编辑标题')

  await page.locator('.editor-panel').getByRole('button', { name: '收藏提示词' }).click()
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const prompts = await window.promptHub.prompts.list()
        return prompts[0]?.isFavorite
      })
    )
    .toBe(true)

  await page.getByRole('button', { name: '删除', exact: true }).click()
  await page.getByRole('button', { name: '确认删除' }).click()
  await expect
    .poll(() => page.evaluate(async () => (await window.promptHub.prompts.list()).length))
    .toBe(initialPromptCount)
})

test('persists the unified text API settings and encrypts the user key', async () => {
  await page.getByRole('button', { name: '设置' }).click()
  await page.getByLabel('服务商预设').selectOption('deepseek')
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const settings = await window.promptHub.settings.list()
        return [settings.ai_preset, settings.ai_base_url, settings.ai_model]
      })
    )
    .toEqual(['deepseek', 'https://api.deepseek.com', 'deepseek-v4-flash'])

  const userKey = 'e2e-user-owned-key'
  await page.getByLabel('API Key').fill(userKey)
  await page.getByRole('button', { name: '保存 API Key' }).click()
  await expect
    .poll(() => page.evaluate(async () => window.promptHub.secure.has('ai.apiKey')))
    .toBe(true)

  const secretFile = readFileSync(join(userDataDirectory, 'secure-store.json'), 'utf8')
  expect(secretFile).not.toContain(userKey)
  await expect(page.getByText('图像生成')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '测试台' })).toHaveCount(0)
})

test('inserts Seedance reference anchors and the shot voice constraint', async () => {
  await page.getByRole('button', { name: 'Seedance2' }).click()
  await expect(page.getByRole('heading', { name: 'Seedance2', level: 1 })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '模板标题' })).toHaveValue('默认模板1')
  await expect(page.getByRole('button', { name: '默认模板', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(page.locator('.s2-accordion h2 button')).toHaveText([
    '风格设定',
    '角色与素材锚定',
    '运镜设定',
    '画面描述',
    '镜头序列',
    '音效设定',
    '特殊要求'
  ])
  await page.getByRole('button', { name: '角色与素材锚定', expanded: false }).click()

  const anchorContent = page.getByLabel('角色与素材锚定内容')
  const expectedAnchors = [
    '将@###作为主角的视觉参考',
    '将@###作为场景的视觉参考',
    '将@###作为道具的视觉参考',
    '将@###作为主角的音色参考'
  ].join('\n')
  await expect(anchorContent).toHaveValue(expectedAnchors)
  await anchorContent.fill('')
  await page.getByRole('button', { name: '插入角色参考' }).click()
  await page.getByRole('button', { name: '插入场景参考' }).click()
  await page.getByRole('button', { name: '插入道具参考' }).click()
  await page.getByRole('button', { name: '插入音色参考' }).click()
  await expect(anchorContent).toHaveValue(expectedAnchors)

  await page.getByRole('button', { name: '镜头序列', expanded: false }).click()
  await page.getByRole('button', { name: '+ 音色约束' }).click()
  await expect(
    page.getByPlaceholder('台词（每行一句，如 地精王："Pathetic."）').first()
  ).toHaveValue('（完全使用@###音色，禁止修改台词）')
})

test('matches the seeded release-library visual baseline', async () => {
  if (process.env.CI) {
    await expect(page.locator('.prompt-card')).toHaveCount(4)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true)
    return
  }

  await expect(page).toHaveScreenshot('library-seeded.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01
  })
})

test('persists a user-selected default Seedance2 template through desktop IPC', async () => {
  await page.getByRole('button', { name: 'Seedance2' }).click()
  await expect(page.getByRole('heading', { name: 'Seedance2', level: 1 })).toBeVisible()

  const newTemplateButton = page.getByRole('button', { name: '+ 新建' })
  const resourceDrawerOpened = await revealResponsiveContent('打开资源面板', newTemplateButton)
  await newTemplateButton.click()
  if (resourceDrawerOpened) {
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '打开资源面板' })).toBeVisible()
  }
  await page.getByRole('textbox', { name: '模板标题' }).fill('E2E 默认模板')
  await page.getByRole('button', { name: '保存为新模板' }).click()
  await expect(page.getByRole('button', { name: '设为默认' })).toBeEnabled()
  await page.getByRole('button', { name: '设为默认' }).click()

  await expect(page.getByRole('button', { name: '默认模板', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const settings = await window.promptHub.settings.list()
        return settings.seedance2_default_template_id
      })
    )
    .toBeTruthy()

  await page.reload()
  await page.getByRole('button', { name: 'Seedance2' }).click()
  await expect(page.getByRole('textbox', { name: '模板标题' })).toHaveValue('E2E 默认模板')
  await expect(page.getByRole('button', { name: '默认模板', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})
