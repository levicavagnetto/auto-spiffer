import { _electron as electron, expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { testUserData } from './test-user-data'

test('Sales screen imports a workbook and PDF, then opens the claim page for matching', async () => {
  const { args, folder, remove } = testUserData()
  const exportPath = join(folder, 'sales.xlsx')
  const pdfPath = join(folder, 'invoice.pdf')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 9, 3), 900701, '235/50R18 GEN RT45', 2])
  sheet.addRow([
    new Date(2026, 9, 3),
    900702,
    '18X8.50/9.50-8 FST TR13 TUBE',
    1
  ])
  await workbook.xlsx.writeFile(exportPath)
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  document.addPage().drawText('Invoice # 900701', { x: 60, y: 700, font })
  writeFileSync(pdfPath, await document.save())

  const app = await electron.launch({
    args,
    env: {
      ...process.env,
      AUTO_SPIFFER_TEST_SITE_FILE: resolve('tests/fixtures/claim-page.html')
    }
  })
  try {
    const page = await app.firstWindow()
    await expect(page.getByText('No sales loaded yet.')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Match tires' })
    ).toBeDisabled()
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    await expect(page.getByText('October 2026', { exact: true })).toBeVisible()
    await expect(page.getByText('2 rows')).toBeVisible()
    await expect(
      page.getByRole('main').getByText('1 tire line', { exact: true })
    ).toBeVisible()
    await expect(page.getByText('1 tube')).toBeVisible()
    await expect(page.getByText('900701')).toBeVisible()
    await expect(page.getByText('Not signed in')).toBeVisible()
    await page.getByLabel('Add invoice PDFs').setInputFiles(pdfPath)
    await expect(page.getByText('1 PDF loaded')).toBeVisible()
    await expect(page.getByText('1 linked to a sale')).toBeVisible()
    await expect(page.getByText('No PDF for invoice 900701')).toHaveCount(0)
    await page.getByRole('button', { name: 'Remove invoice.pdf' }).click()
    await expect(page.getByText('0 PDFs loaded')).toBeVisible()
    await page.getByRole('button', { name: 'Match tires' }).click()
    await expect
      .poll(() => page.evaluate(() => window.api.getSiteStatus()))
      .toMatchObject({ state: 'ready' })
    await expect
      .poll(() => page.evaluate(() => window.api.getSiteLocation()))
      .toBe('claim')
    await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Review', exact: true })
    ).toBeEnabled()
  } finally {
    await app.close()
    remove()
  }
})

test('Sales screen names a missing export column', async () => {
  const { args, folder, remove } = testUserData()
  const path = join(folder, 'missing-column.xlsx')
  const workbook = new ExcelJS.Workbook()
  workbook
    .addWorksheet('Report')
    .addRow(['Invoiced', 'Invoice #', 'Description'])
  await workbook.xlsx.writeFile(path)
  const app = await electron.launch({ args })
  try {
    const page = await app.firstWindow()
    await page.getByLabel('Choose Material Sales export').setInputFiles(path)
    await expect(page.getByRole('alert')).toHaveText(
      'This file does not look like a Material Sales export: the Quantity column is missing.'
    )
    await expect(
      page.getByRole('button', { name: 'Match tires' })
    ).toBeDisabled()
  } finally {
    await app.close()
    remove()
  }
})
