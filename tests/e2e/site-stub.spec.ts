import { _electron as electron, expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { installSiteStub } from './site-stub'
import { testUserData } from './test-user-data'

test('test stub makes Add append a sale row', async () => {
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
    await installSiteStub(app)
    await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      await view.webContents.executeJavaScript(`
        document.querySelector('#ctl00_DefaultContent_InvoiceDateRadDatePicker_dateInput').value = '10/18/2026';
        document.querySelector('#ctl00_DefaultContent_InvoiceNumberTextBox').value = '900001';
        document.querySelector('#DefaultContent_ProductDropdownList').value = '5';
        document.querySelector('#ctl00_DefaultContent_QtyClaimedRadNumericTextBox').value = '4';
      `)
    })
    await app.evaluate(async () => {
      const driver = (
        globalThis as {
          __siteDriver?: { guardedClick: (selector: string) => Promise<void> }
        }
      ).__siteDriver!
      await driver.guardedClick('#DefaultContent_AddProductLinkButton')
    })
    await expect
      .poll(
        async () =>
          (await page.evaluate(() => window.api.readSitePage()))?.lines.length
      )
      .toBe(1)
    const line = (await page.evaluate(() => window.api.readSitePage()))
      ?.lines[0]
    expect(line?.invoice).toBe('900001')
    expect(line?.qty).toBe(4)
  } finally {
    await app.close()
    remove()
  }
})
