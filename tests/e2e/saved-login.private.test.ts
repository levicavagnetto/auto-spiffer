import { _electron as electron, expect, test } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { testUserData } from './test-user-data'

const savedPage = resolve('private-data/site-pages/ATD ProRewards Login.htm')

async function launchWithStub(success: boolean) {
  const user = testUserData()
  const app = await electron.launch({
    args: user.args,
    env: { ...process.env, AUTO_SPIFFER_TEST_SITE_FILE: savedPage }
  })
  const page = await app.firstWindow()
  await page.evaluate(() =>
    window.api.saveCredentials({
      email: 'shop@example.com',
      password: 'test-only-password'
    })
  )
  await app.evaluate(({ BrowserWindow }, shouldSucceed) => {
    const view = BrowserWindow.getAllWindows()[0]!.contentView
      .children[0] as Electron.WebContentsView
    view.webContents.on('dom-ready', () => {
      void view.webContents.executeJavaScript(`
        window.__loginAttempts = 0;
        window.__doPostBack = () => {
          window.__loginAttempts += 1;
          if (${shouldSucceed}) document.querySelector('#UserLogin_Password')?.remove();
        };
      `)
    })
  }, success)
  await page.getByRole('button', { name: 'ProRewards' }).click()
  return { ...user, app, page }
}

test('saved login page signs in once with the encrypted password', async () => {
  test.skip(!existsSync(savedPage), 'Private saved login page unavailable')
  const { app, page, remove } = await launchWithStub(true)
  try {
    await expect
      .poll(() => page.evaluate(() => window.api.getSiteLocation()))
      .toBe('other')
    const attempts = await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      return view.webContents.executeJavaScript('window.__loginAttempts')
    })
    expect(attempts).toBe(1)
  } finally {
    await app.close()
    remove()
  }
})

test('saved login page stops after one unsuccessful attempt', async () => {
  test.skip(!existsSync(savedPage), 'Private saved login page unavailable')
  test.setTimeout(40_000)
  const { app, page, remove } = await launchWithStub(false)
  try {
    await expect(page.getByRole('alert')).toContainText(
      'The website did not finish signing in',
      { timeout: 27_000 }
    )
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'ProRewards' }).click()
    const attempts = await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      return view.webContents.executeJavaScript('window.__loginAttempts')
    })
    expect(attempts).toBe(1)
  } finally {
    await app.close()
    remove()
  }
})
