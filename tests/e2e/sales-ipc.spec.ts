import { _electron as electron, expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { testUserData } from './test-user-data'

test('main process reads dropped export and PDFs and validates paths', async () => {
  const { args, folder, remove } = testUserData()
  const exportPath = join(folder, 'sales.xlsx')
  const pdfPath = join(folder, 'invoice.pdf')
  const badPdfPath = join(folder, 'broken.pdf')
  const textPath = join(folder, 'notes.txt')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 8, 3), 900601, '235/50R18 GEN RT45', 2])
  await workbook.xlsx.writeFile(exportPath)
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  document.addPage().drawText('Invoice # 900601', { x: 60, y: 700, font })
  writeFileSync(pdfPath, await document.save())
  writeFileSync(badPdfPath, 'not a PDF')
  writeFileSync(textPath, 'not a PDF')

  const app = await electron.launch({ args })
  try {
    const page = await app.firstWindow()
    const loaded = await page.evaluate(
      (path) => window.api.loadSalesExport(path),
      exportPath
    )
    expect(loaded.state.sales[0]).toMatchObject({ invoice: '900601', qty: 2 })
    const added = await page.evaluate(
      (paths) => window.api.addInvoicePaths(paths),
      [pdfPath, badPdfPath, textPath]
    )
    expect(added.links.linkedCount).toBe(1)
    expect(added.links.unreadablePdfs.map((pdf) => pdf.name)).toEqual([
      'broken.pdf'
    ])
    expect(added.warnings.join(' ')).toContain('notes.txt')
    const removed = await page.evaluate(
      (path) => window.api.removeInvoicePdf(path),
      pdfPath
    )
    expect(removed.links.missingInvoices).toEqual(['900601'])
    expect(
      await page.evaluate(() => window.api.getSalesSnapshot())
    ).not.toBeNull()
  } finally {
    await app.close()
    remove()
  }
})

test('sales are forgotten when the app closes', async () => {
  const { args, folder, remove } = testUserData()
  const exportPath = join(folder, 'sales.xlsx')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 8, 3), 900611, '235/50R18 GEN RT45', 1])
  await workbook.xlsx.writeFile(exportPath)
  try {
    const first = await electron.launch({ args })
    try {
      const page = await first.firstWindow()
      await page.evaluate(
        (path) => window.api.loadSalesExport(path),
        exportPath
      )
    } finally {
      await first.close()
    }
    const restarted = await electron.launch({ args })
    try {
      const page = await restarted.firstWindow()
      expect(
        await page.evaluate(() => window.api.getSalesSnapshot())
      ).toBeNull()
    } finally {
      await restarted.close()
    }
  } finally {
    remove()
  }
})
