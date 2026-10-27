import { _electron as electron, expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { join, resolve } from 'node:path'
import { testUserData } from './test-user-data'

test('sidebar and Sales card show the claim page state and program', async () => {
  const { args, folder, remove } = testUserData()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 9, 18), 900801, '225/55R17 NOK REMEDY WRG5', 1])
  const exportPath = join(folder, 'sales.xlsx')
  await workbook.xlsx.writeFile(exportPath)
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
      .poll(() => page.evaluate(() => window.api.getSiteLocation()))
      .toBe('claim')
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' })
    ).toContainText('Signed in')
    await page.getByRole('button', { name: 'Sales' }).click()
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    const card = page.getByRole('heading', { name: 'ProRewards' }).locator('..')
    await expect(card).toContainText('Signed in')
    await expect(card).toContainText('October 2026 Pro Rewards')
    await expect(card).toContainText('6 tires')
  } finally {
    await app.close()
    remove()
  }
})
