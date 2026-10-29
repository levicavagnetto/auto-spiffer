import { _electron as electron, expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { installSiteStub } from './site-stub'
import { testUserData } from './test-user-data'

const savedPage = resolve(
  'private-data/site-pages/ATD ProRewards - Submit Claim.htm'
)

test('a generated sale runs against the private saved claim page without clicking Next', async () => {
  test.skip(!existsSync(savedPage), 'Private claim page is not available')
  const { args, folder, remove } = testUserData()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 9, 18), 900501, '225/55R17 NOK REMEDY WRG5', 1])
  const exportPath = join(folder, 'sales.xlsx')
  await workbook.xlsx.writeFile(exportPath)
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
    await installSiteStub(app)
    await page.getByRole('button', { name: 'Sales' }).click()
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    await page.getByRole('button', { name: 'Match tires' }).click()
    await page.getByRole('button', { name: 'Enter 1 sale' }).click()
    await page.getByRole('button', { name: 'Start entering' }).click()
    await expect
      .poll(
        async () => (await page.evaluate(() => window.api.getRunState())).phase
      )
      .toBe('finished')
    const state = await page.evaluate(() => window.api.getRunState())
    expect(state.summary?.added).toHaveLength(1)
    const site = await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      return view.webContents.executeJavaScript(
        `({ next: window.__stub.nextClicked, clicks: window.__stub.clicks })`
      )
    })
    expect(site.next).toBe(false)
    expect(site.clicks).not.toContain('DefaultContent_YesLinkButton')
  } finally {
    await app.close()
    remove()
  }
})
