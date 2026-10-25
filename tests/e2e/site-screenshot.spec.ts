import { _electron as electron, expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { testUserData } from './test-user-data'

test('saves a PNG of the site tab in the logs folder', async () => {
  const { args, folder, remove } = testUserData()
  const app = await electron.launch({
    args,
    env: {
      ...process.env,
      AUTO_SPIFFER_TEST_SITE_FILE: resolve('tests/fixtures/claim-page.html')
    }
  })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect
      .poll(() => page.evaluate(() => window.api.isClaimPage()))
      .toBe(true)
    const saved = await app.evaluate(async () => {
      const driver = (
        globalThis as {
          __siteDriver?: { screenshot: (name: string) => Promise<string> }
        }
      ).__siteDriver!
      return driver.screenshot('TEST-900001')
    })
    expect(dirname(saved)).toBe(resolve(folder, 'logs'))
    expect(saved).toMatch(/TEST-900001\.png$/)
    expect(readFileSync(saved).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  } finally {
    await app.close()
    remove()
  }
})
