import { _electron as electron, expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { join, resolve } from 'node:path'
import { testUserData } from './test-user-data'

test('a decision updates matching lines and saved match can be removed', async () => {
  const { args, folder, remove } = testUserData()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 9, 3), 900801, '245/55R19 NOK ONE 80K', 1])
  sheet.addRow([new Date(2026, 9, 4), 900802, '215/70R16 NOK ONE 80K', 2])
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
      .poll(() => page.evaluate(() => window.api.isClaimPage()))
      .toBe(true)
    await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      await view.webContents.executeJavaScript(
        "document.querySelector('#DefaultContent_ProductDropdownList option[value=\"6\"]').textContent = 'Nokian One HT - Light Truck Tires'"
      )
    })
    await page.getByRole('button', { name: 'Sales' }).click()
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    await page.getByRole('button', { name: 'Match tires' }).click()
    await expect(page.getByText('Decide 2 tires to continue')).toBeVisible()
    await page.getByRole('button', { name: /Review 900801/ }).click()
    await expect(
      page.getByRole('dialog', { name: 'Which tire is this?' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Use Nokian One HT' }).click()
    await expect(page.getByText('2 ready (3 tires)')).toBeVisible()
    await page.getByRole('button', { name: /Saved matches/ }).click()
    await expect(page.getByText('nokian|one')).toBeVisible()
    await page.getByRole('button', { name: 'Remove nokian|one' }).click()
    await expect(page.getByText('0 saved matches')).toBeVisible()
    await page.getByRole('button', { name: 'Sales' }).click()
    await page.getByRole('button', { name: 'Match tires' }).click()
    await expect(page.getByText('Decide 2 tires to continue')).toBeVisible()
  } finally {
    await app.close()
    remove()
  }
})

test('Review separates possible wheels from tires and tubes', async () => {
  const { args, folder, remove } = testUserData()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([
    new Date(2026, 9, 3),
    900811,
    'CON SECURECONTACT AW 225/65R17',
    2
  ])
  sheet.addRow([
    new Date(2026, 9, 3),
    900812,
    'STYLE A 20X10 -12 5X5.00 BLACK',
    1
  ])
  sheet.addRow([new Date(2026, 9, 3), 900813, 'TR13 TUBE', 1])
  const exportPath = join(folder, 'wheel-sales.xlsx')
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
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    await page.getByRole('button', { name: 'Match tires' }).click()
    await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Enter 1 sale' })
    ).toBeEnabled()
    await page.getByRole('tab', { name: 'Wheels 1' }).click()
    await expect(page.getByText('900812')).toBeVisible()
    await expect(page.getByText('900811')).toHaveCount(0)
    await expect(page.getByText('900813')).toHaveCount(0)
    await expect(
      page.getByText(/Check whether they qualify for ATD Custom Wheels/)
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Review 900812/ })
    ).toHaveCount(0)
    await page.getByRole('tab', { name: 'Not a tire 1' }).click()
    await expect(page.getByText('900813')).toBeVisible()
  } finally {
    await app.close()
    remove()
  }
})
