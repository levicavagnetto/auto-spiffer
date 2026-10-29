import { _electron as electron, expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { testUserData } from './test-user-data'

test('guarded Next never sends a click to the claim page', async () => {
  const { args, remove } = testUserData()
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
    await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      await view.webContents.executeJavaScript(`
        window.__nextClicks = 0;
        document.querySelector('#DefaultContent_GoToStepFourLinkButton')
          .addEventListener('click', () => window.__nextClicks++);
      `)
    })
    await expect(
      app.evaluate(async () => {
        const driver = (
          globalThis as {
            __siteDriver?: { guardedClick: (selector: string) => Promise<void> }
          }
        ).__siteDriver!
        await driver.guardedClick('#DefaultContent_GoToStepFourLinkButton')
      })
    ).rejects.toThrow('refused')
    const clicks = await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      return view.webContents.executeJavaScript(
        'window.__nextClicks'
      ) as Promise<number>
    })
    expect(clicks).toBe(0)
  } finally {
    await app.close()
    remove()
  }
})
