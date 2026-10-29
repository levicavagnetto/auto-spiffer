import { _electron as electron, expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { testUserData } from './test-user-data'

test('test claim page cancels HTTPS requests before they leave the tab', async () => {
  const { args, remove } = testUserData()
  const fixture = resolve('tests/fixtures/claim-page.html')
  const app = await electron.launch({
    args,
    env: { ...process.env, AUTO_SPIFFER_TEST_SITE_FILE: fixture }
  })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) => {
          const view = BrowserWindow.getAllWindows()[0]?.contentView
            .children[0] as Electron.WebContentsView
          return view?.webContents.getURL()
        })
      )
      .toBe(pathToFileURL(fixture).href)
    await app.evaluate(async ({ BrowserWindow, session }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      session
        .fromPartition('persist:prorewards')
        .webRequest.onErrorOccurred((details) => {
          if (details.url.includes('blocked.png')) {
            ;(globalThis as { __blockedError?: string }).__blockedError =
              details.error
          }
        })
      await view.webContents.executeJavaScript(
        'const img = new Image(); img.src = "https://example.org/blocked.png"; document.body.appendChild(img)'
      )
    })
    await expect
      .poll(() =>
        app.evaluate(
          () => (globalThis as { __blockedError?: string }).__blockedError
        )
      )
      .toBe('net::ERR_BLOCKED_BY_CLIENT')
  } finally {
    await app.close()
    remove()
  }
})
