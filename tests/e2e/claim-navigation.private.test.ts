import { _electron as electron, expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { testUserData } from './test-user-data'

const savedPage = resolve(
  'private-data/site-pages/ATD ProRewards - Submit Sales.htm'
)
const claimPage = resolve('tests/fixtures/claim-page.html')

for (const scenario of ['one', 'none', 'two', 'stuck'] as const) {
  test(`Match tires handles ${scenario} program outcome on saved page`, async () => {
    test.skip(!existsSync(savedPage), 'Private saved program page unavailable')
    test.setTimeout(35_000)
    const { args, folder, remove } = testUserData()
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Report')
    sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
    sheet.addRow([
      new Date(2026, 9, 18),
      900851,
      '225/55R17 NOK REMEDY WRG5',
      1
    ])
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
        .poll(() => page.evaluate(() => window.api.getSiteLocation()))
        .toBe('program-choice')
      await app.evaluate(async ({ BrowserWindow }, outcome) => {
        const view = BrowserWindow.getAllWindows()[0]!.contentView
          .children[0] as Electron.WebContentsView
        await view.webContents.executeJavaScript(`
          window.__programNextClicks = 0;
          window.__doPostBack = (target) => {
            if (target.includes('PromotionCodeNextLinkButton')) window.__programNextClicks++;
          };
          if (${JSON.stringify(outcome)} === 'none') {
            [...document.querySelectorAll('#DefaultContent_PromotionDropDownList option')]
              .find(option => option.textContent.includes('October 2026'))?.remove();
          }
          if (${JSON.stringify(outcome)} === 'two') {
            const extra = document.createElement('option');
            extra.value = '999'; extra.textContent = 'October 2026 Second Program';
            document.querySelector('#DefaultContent_PromotionDropDownList').append(extra);
          }
        `)
      }, scenario)
      await page.getByRole('button', { name: 'Sales' }).click()
      await page
        .getByLabel('Choose Material Sales export')
        .setInputFiles(exportPath)
      await page.getByRole('button', { name: 'Match tires' }).click()
      const nextClicks = () =>
        app.evaluate(async ({ BrowserWindow }) => {
          const view = BrowserWindow.getAllWindows()[0]!.contentView
            .children[0] as Electron.WebContentsView
          return view.webContents.executeJavaScript(
            'window.__programNextClicks'
          ) as Promise<number>
        })
      if (scenario === 'none' || scenario === 'two') {
        await expect(page.getByRole('alert')).toContainText(
          'Pick the program in the ProRewards tab.'
        )
        expect(await nextClicks()).toBe(0)
      } else {
        await expect.poll(nextClicks).toBe(1)
        if (scenario === 'stuck')
          await expect(page.getByRole('alert')).toContainText(
            'The claim page did not open.',
            { timeout: 22_000 }
          )
      }
      await app.evaluate(async ({ BrowserWindow }, address) => {
        const view = BrowserWindow.getAllWindows()[0]!.contentView
          .children[0] as Electron.WebContentsView
        await view.webContents.loadURL(address)
      }, pathToFileURL(claimPage).href)
      await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible({
        timeout: 8_000
      })
    } finally {
      await app.close()
      remove()
    }
  })
}
