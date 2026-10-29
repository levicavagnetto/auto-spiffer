import { _electron as electron, expect, test } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { testUserData } from './test-user-data'

const loginPage = resolve('private-data/site-pages/ATD ProRewards Login.htm')

test('Sign out and forget password clears site cookies and shows login', async () => {
  test.skip(!existsSync(loginPage), 'Private saved login page unavailable')
  const { args, remove } = testUserData()
  const app = await electron.launch({
    args,
    env: { ...process.env, AUTO_SPIFFER_TEST_SITE_FILE: loginPage }
  })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect
      .poll(() => page.evaluate(() => window.api.getSiteLocation()))
      .toBe('login')
    await app.evaluate(async ({ session }) => {
      await session.fromPartition('persist:prorewards').cookies.set({
        url: 'https://prorewards.acbrewards.com/',
        name: 'test-session',
        value: 'keep-me',
        expirationDate: Math.floor(Date.now() / 1000) + 86_400
      })
    })
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('textbox', { name: 'Email' }).fill('shop@example.com')
    await page
      .getByLabel('Password', { exact: true })
      .fill('test-only-password')
    await page.getByRole('button', { name: 'Save password' }).click()
    await expect(
      page.getByText('Saved, encrypted with your Windows account')
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Sign out and forget password' })
      .click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Signed out and forgot' })
    ).toContainText('Signed out and forgot')
    expect(
      await page.evaluate(() => window.api.getCredentials())
    ).toMatchObject({ hasPassword: false })
    const cookies = await app.evaluate(({ session }) =>
      session
        .fromPartition('persist:prorewards')
        .cookies.get({ name: 'test-session' })
    )
    expect(cookies).toHaveLength(0)
    expect(await page.evaluate(() => window.api.getSiteLocation())).toBe(
      'login'
    )
  } finally {
    await app.close()
    remove()
  }
})
