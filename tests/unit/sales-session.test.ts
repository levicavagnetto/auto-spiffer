import { afterEach, expect, test } from 'vitest'
import ExcelJS from 'exceljs'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SalesSession } from '../../src/main/sales/session'
import type { InvoicePdf } from '../../src/shared/sales'

const folders: string[] = []
function fixtureFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'auto-spiffer-session-'))
  folders.push(folder)
  return folder
}
afterEach(() => {
  for (const folder of folders.splice(0))
    rmSync(folder, { recursive: true, force: true })
})

test('session replaces an export, adds PDFs, and removes a PDF without saving a month', async () => {
  const folder = fixtureFolder()
  const exportPath = join(folder, 'sales.xlsx')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 8, 3), 900501, '235/50R18 GEN RT45', 1])
  await workbook.xlsx.writeFile(exportPath)
  const pdfPath = join(folder, 'invoice.pdf')
  writeFileSync(pdfPath, 'PDF')
  const readPdf = async (path: string): Promise<InvoicePdf> => ({
    path,
    name: 'invoice.pdf',
    invoice: '900501',
    fromFileName: false,
    notes: [],
    sha256: 'test-hash'
  })
  const session = new SalesSession(readPdf)
  expect(session.snapshot()).toBeNull()
  expect((await session.loadExport(exportPath)).state.sales).toHaveLength(1)
  expect((await session.addPaths([pdfPath])).links.linkedCount).toBe(1)
  expect((await session.removePdf(pdfPath)).state.pdfs).toEqual([])
  await session.addPaths([pdfPath])
  expect((await session.loadExport(exportPath)).state.pdfs).toEqual([])
})
