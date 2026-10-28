import { _electron as electron, expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { testUserData } from './test-user-data'

test('Settings saves an encrypted password and can forget it', async () => {
  const { args, folder, remove } = testUserData()
  const app = await electron.launch({ args })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('textbox', { name: 'Email' }).fill('shop@example.com')
    await page.getByLabel('Password', { exact: true }).fill('test-only-secret')
    await page.getByRole('button', { name: 'Save password' }).click()
    await expect(
      page.getByText('Saved, encrypted with your Windows account')
    ).toBeVisible()
    expect(
      readFileSync(join(folder, 'credentials.json'), 'utf8')
    ).not.toContain('test-only-secret')
    const staySignedIn = page.getByRole('checkbox', { name: 'Stay signed in' })
    await expect(staySignedIn).toBeChecked()
    await staySignedIn.click()
    await expect
      .poll(() => page.evaluate(() => window.api.getCredentials()))
      .toMatchObject({
        email: 'shop@example.com',
        hasPassword: true,
        staySignedIn: false
      })
    await expect(staySignedIn).not.toBeChecked()
    await page
      .getByRole('button', { name: 'Sign out and forget password' })
      .click()
    await expect
      .poll(() => page.evaluate(() => window.api.getCredentials()))
      .toMatchObject({
        email: '',
        hasPassword: false,
        staySignedIn: false
      })
  } finally {
    await app.close()
    remove()
  }
})
