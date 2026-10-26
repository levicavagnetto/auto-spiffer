import ExcelJS from 'exceljs'
import { extname } from 'node:path'
import type { Sale, SalesState } from '../../shared/sales'
import { chooseMonth, classifySale } from './rules'

const required = ['Invoiced', 'Invoice #', 'Description', 'Quantity'] as const

function readDate(value: ExcelJS.CellValue): string | null {
  let date: Date | null = null
  let useUtc = false
  if (value instanceof Date) date = value
  else if (typeof value === 'number') {
    date = new Date(Date.UTC(1899, 11, 30) + Math.trunc(value) * 86_400_000)
    useUtc = true
  } else if (typeof value === 'string') {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim())
    if (match) date = new Date(+match[3]!, +match[1]! - 1, +match[2]!)
  }
  if (!date || Number.isNaN(date.getTime())) return null
  const year = useUtc ? date.getUTCFullYear() : date.getFullYear()
  const month = (useUtc ? date.getUTCMonth() : date.getMonth()) + 1
  const day = useUtc ? date.getUTCDate() : date.getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function readInvoice(value: ExcelJS.CellValue): string | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return String(Math.trunc(value))
  if (typeof value === 'string') return value.trim() || null
  return null
}

function readQuantity(value: ExcelJS.CellValue): number | null {
  const qty =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : NaN
  return Number.isSafeInteger(qty) && qty > 0 ? qty : null
}

function headings(row: ExcelJS.Row): Map<string, number> {
  const found = new Map<string, number>()
  row.eachCell((cell, index) => {
    const heading = cell.text.replace(/\s+/g, ' ').trim().toLowerCase()
    if (heading) found.set(heading, index)
  })
  return found
}

export async function readSalesExport(path: string): Promise<SalesState> {
  if (extname(path).toLowerCase() !== '.xlsx')
    throw new Error('This file could not be read as an Excel workbook.')
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.readFile(path)
  } catch {
    throw new Error('This file could not be read as an Excel workbook.')
  }

  let selected: {
    sheet: ExcelJS.Worksheet
    headingRow: number
    columns: Map<string, number>
  } | null = null
  let closest = new Map<string, number>()
  for (const sheet of workbook.worksheets) {
    for (
      let rowNumber = 1;
      rowNumber <= Math.min(10, sheet.rowCount);
      rowNumber++
    ) {
      const columns = headings(sheet.getRow(rowNumber))
      const score = required.filter((heading) =>
        columns.has(heading.toLowerCase())
      ).length
      const closestScore = required.filter((heading) =>
        closest.has(heading.toLowerCase())
      ).length
      if (score > closestScore) closest = columns
      if (score === required.length) {
        selected = { sheet, headingRow: rowNumber, columns }
        break
      }
    }
    if (selected) break
  }
  if (!selected) {
    const missing =
      required.find((heading) => !closest.has(heading.toLowerCase())) ??
      required[0]
    throw new Error(
      `This file does not look like a Material Sales export: the ${missing} column is missing.`
    )
  }

  const { sheet, headingRow, columns } = selected
  const cell = (
    row: ExcelJS.Row,
    heading: (typeof required)[number]
  ): ExcelJS.CellValue => row.getCell(columns.get(heading.toLowerCase())!).value
  const sales: Sale[] = []
  const unreadable: SalesState['unreadable'] = []
  for (
    let rowNumber = headingRow + 1;
    rowNumber <= sheet.rowCount;
    rowNumber++
  ) {
    const row = sheet.getRow(rowNumber)
    if (!row.hasValues) continue
    const values = required.map((heading) => cell(row, heading))
    if (
      values.every(
        (value) => value === null || value === undefined || value === ''
      )
    )
      continue
    const saleDate = readDate(cell(row, 'Invoiced'))
    const invoice = readInvoice(cell(row, 'Invoice #'))
    const description = row
      .getCell(columns.get('description')!)
      .text.replace(/\s+/g, ' ')
      .trim()
    const qty = readQuantity(cell(row, 'Quantity'))
    const why = !saleDate
      ? 'The date is missing or invalid.'
      : !invoice
        ? 'The invoice number is missing.'
        : !description
          ? 'The description is missing.'
          : qty === null
            ? 'The quantity is not a whole number.'
            : null
    if (why) {
      unreadable.push({ row: rowNumber, why })
      continue
    }
    sales.push({
      row: rowNumber,
      saleDate: saleDate!,
      invoice: invoice!,
      description,
      qty: qty!,
      notATire: classifySale(description)
    })
  }
  const month = chooseMonth(sales)
  return {
    file: path,
    sales,
    unreadable,
    ...month,
    pdfs: []
  }
}
