import { _electron as electron, expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { testUserData } from './test-user-data'

const savedPage = resolve(
  'private-data/site-pages/ATD ProRewards - Submit Claim.htm'
)

test('reads the saved October claim page word for word', async () => {
  test.skip(!existsSync(savedPage), 'Private claim page is not available')
  const { args, remove } = testUserData()
  const app = await electron.launch({
    args,
    env: { ...process.env, AUTO_SPIFFER_TEST_SITE_FILE: savedPage }
  })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect
      .poll(() => page.evaluate(() => window.api.isClaimPage()))
      .toBe(true)
    const read = await page.evaluate(() => window.api.readSitePage())
    const expectedTires = readFileSync(
      resolve('docs/reference/tire-list-2026-10.txt'),
      'utf8'
    )
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
    expect(expectedTires).toHaveLength(77)
    expect(read?.tires).toEqual(expectedTires)
    expect(read?.promotion).toBe('October 2026 Pro Rewards')
    expect(
      read?.window.map((date) => date?.toISOString().slice(0, 10))
    ).toEqual(['2026-10-01', '2026-10-31'])
  } finally {
    await app.close()
    remove()
  }
})
