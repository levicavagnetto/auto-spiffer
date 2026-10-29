import { _electron as electron, expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { testUserData } from './test-user-data'

test('opens the Auto Spiffer window', async () => {
  const { args, remove } = testUserData()
  const app = await electron.launch({ args })
  try {
    const page = await app.firstWindow()
    await expect(page).toHaveTitle('Auto Spiffer')
    await expect(page.getByText('Auto Spiffer')).toBeVisible()
    expect(
      await app.evaluate(({ Menu }) => Menu.getApplicationMenu())
    ).toBeNull()
    const version = JSON.parse(readFileSync('package.json', 'utf8'))
      .version as string
    await expect(page.evaluate(() => window.api.getAppVersion())).resolves.toBe(
      version
    )
  } finally {
    await app.close()
    remove()
  }
})

test('keeps system APIs out of the screen and blocks other pages', async () => {
  const { args, remove } = testUserData()
  const app = await electron.launch({ args })
  try {
    const page = await app.firstWindow()
    const initialUrl = page.url()
    const exposed = await page.evaluate(() => ({
      require: typeof (globalThis as { require?: unknown }).require,
      process: typeof (globalThis as { process?: unknown }).process
    }))
    expect(exposed).toEqual({ require: 'undefined', process: 'undefined' })

    await page.evaluate(
      (target) => {
        window.location.href = target
      },
      pathToFileURL(resolve('README.md')).href
    )
    await page.waitForTimeout(300)
    expect(page.url()).toBe(initialUrl)

    const popup = await page.evaluate(() => window.open('about:blank'))
    expect(popup).toBeNull()
    expect(await app.windows()).toHaveLength(1)
  } finally {
    await app.close()
    remove()
  }
})
