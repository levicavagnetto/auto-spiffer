import { _electron as electron, expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { join, resolve } from 'node:path'
import { testUserData } from './test-user-data'

test('sidebar stays visible through a long Review page and navigation starts at the top', async () => {
  const { args, folder, remove } = testUserData()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  for (let index = 0; index < 35; index++) {
    sheet.addRow([
      new Date(2026, 9, 18),
      900700 + index,
      '225/55R17 NOK REMEDY WRG5',
      1
    ])
  }
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
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.setSize(1100, 700)
    )
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect
      .poll(() => page.evaluate(() => window.api.isClaimPage()))
      .toBe(true)
    await page.getByRole('button', { name: 'Sales' }).click()
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    await page.getByRole('button', { name: 'Match tires' }).click()
    await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
    const enter = page
      .locator('main > header')
      .getByRole('button', { name: 'Enter 35 sales' })
    await expect(enter).toHaveCount(1)
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    )
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0)
    const sidebar = page.locator('aside').first()
    await expect
      .poll(async () => (await sidebar.boundingBox())?.y ?? -1000)
      .toBeGreaterThanOrEqual(-1)
    await expect(
      page.getByRole('button', { name: 'Settings' })
    ).toBeInViewport()
    await expect(enter).toBeInViewport()
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  } finally {
    await app.close()
    remove()
  }
})
