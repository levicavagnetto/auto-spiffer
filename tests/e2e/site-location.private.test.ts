import { _electron as electron, expect, test } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { testUserData } from './test-user-data'

for (const [name, file, expected] of [
  ['login', 'ATD ProRewards Login.htm', 'login'],
  ['home', 'ATD ProRewards Spiff.htm', 'other'],
  ['program choice', 'ATD ProRewards - Submit Sales.htm', 'program-choice'],
  ['claim', 'ATD ProRewards - Submit Claim.htm', 'claim']
] as const) {
  test(`detects the saved ${name} page`, async () => {
    const path = resolve('private-data/site-pages', file)
    test.skip(!existsSync(path), 'Private saved page is unavailable')
    const { args, remove } = testUserData()
    const app = await electron.launch({
      args,
      env: { ...process.env, AUTO_SPIFFER_TEST_SITE_FILE: path }
    })
    try {
      const page = await app.firstWindow()
      await page.getByRole('button', { name: 'ProRewards' }).click()
      await expect
        .poll(() => page.evaluate(() => window.api.getSiteStatus()))
        .toMatchObject({ state: 'ready' })
      expect(await page.evaluate(() => window.api.getSiteLocation())).toBe(
        expected
      )
    } finally {
      await app.close()
      remove()
    }
  })
}
