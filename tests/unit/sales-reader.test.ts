import { afterEach, describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readSalesExport } from '../../src/main/sales/reader'

const folders: string[] = []
function fixturePath(name: string): string {
  const folder = mkdtempSync(join(tmpdir(), 'auto-spiffer-sales-'))
  folders.push(folder)
  return join(folder, name)
}

afterEach(() => {
  for (const folder of folders.splice(0))
    rmSync(folder, { recursive: true, force: true })
})

describe('readSalesExport', () => {
  it('finds reordered headings and reports an unreadable row without losing valid sales', async () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('Intro').addRow(['Material Sales'])
    const sheet = workbook.addWorksheet('Report')
    sheet.addRow(['Material Sales'])
    sheet.addRow([])
    sheet.addRow([
      'supplier',
      'QUANTITY',
      'Description',
      'Invoice #',
      'Invoiced',
      'Extra'
    ])
    sheet.addRow([
      'Supplier',
      '4',
      '  235/50R18   GEN  RT45  ',
      214248,
      new Date(2026, 8, 3, 15),
      'ignored'
    ])
    sheet.addRow([])
    sheet.addRow([
      'Supplier',
      'not a number',
      '205/60R16 FAL AKLIMATE',
      214249,
      new Date(2026, 8, 4)
    ])
    sheet.addRow([
      'Supplier',
      2,
      '225/65R17 CON SECURECONTACT AW',
      214250,
      null
    ])
    const path = fixturePath('sales.xlsx')
    await workbook.xlsx.writeFile(path)

    const state = await readSalesExport(path)
    expect(state.sales).toMatchObject([
      {
        row: 4,
        saleDate: '2026-09-03',
        invoice: '214248',
        description: '235/50R18 GEN RT45',
        qty: 4
      }
    ])
    expect(state.unreadable).toEqual([
      { row: 6, why: expect.stringContaining('quantity') },
      { row: 7, why: expect.stringContaining('date') }
    ])
    expect(state.file).toBe(path)
  })

  it('names a missing required column', async () => {
    const workbook = new ExcelJS.Workbook()
    workbook
      .addWorksheet('Report')
      .addRow(['Invoiced', 'Invoice #', 'Description'])
    const path = fixturePath('missing.xlsx')
    await workbook.xlsx.writeFile(path)
    await expect(readSalesExport(path)).rejects.toThrow(
      'This file does not look like a Material Sales export: the Quantity column is missing.'
    )
  })

  it('rejects a file that is not a readable workbook', async () => {
    const path = fixturePath('bad.xlsx')
    writeFileSync(path, 'not a workbook')
    await expect(readSalesExport(path)).rejects.toThrow(
      'could not be read as an Excel workbook'
    )
  })

  it('keeps the calendar day from a numeric Excel date', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Report')
    sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
    const serial = (Date.UTC(2026, 8, 3) - Date.UTC(1899, 11, 30)) / 86_400_000
    sheet.addRow([serial, 900801, '235/50R18 GEN RT45', 1])
    const path = fixturePath('numeric-date.xlsx')
    await workbook.xlsx.writeFile(path)
    expect((await readSalesExport(path)).sales[0]?.saleDate).toBe('2026-09-03')
  })
})
