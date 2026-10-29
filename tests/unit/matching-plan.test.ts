import { expect, it } from 'vitest'
import { planLines } from '../../src/main/matching/plan'
import { parseTireList } from '../../src/main/matching/tireList'
import type { Sale } from '../../src/shared/sales'

const tires = parseTireList([
  'Falken Aklimate - Passenger Tires',
  'Continental SecureContact AW - Passenger Tires',
  'Nokian One HT - Light Truck Tires',
  'Hercules Terra Trac A/T - Light Truck Tires'
])
const sale = (
  row: number,
  invoice: string,
  description: string,
  qty: number,
  date = '2026-09-03'
): Sale => ({ row, invoice, description, qty, saleDate: date, notATire: null })

it('merges two wordings of one tire on one invoice without changing inputs', () => {
  const sales = [
    sale(2, '900001', '205/60R16 92V FAL AKLIMATE BW', 2),
    sale(3, '900001', 'FAL AKLIMATE 205/60R16', 2),
    sale(4, '900001', 'CON SECURECONTACT AW 225/65R17', 1),
    sale(5, '900002', 'FAL AKLIMATE 205/60R16', 1)
  ]
  const lines = planLines(sales, tires, {}, {}, {}, new Set(), [
    '2026-09-01',
    '2026-09-30'
  ])
  expect(lines.map((line) => [line.invoice, line.qty, line.rows])).toEqual([
    ['900001', 4, [2, 3]],
    ['900001', 1, [4]],
    ['900002', 1, [5]]
  ])
  expect(sales[0]?.qty).toBe(2)
})

it('merges matching uncertain wording, links PDFs and leaves a line out', () => {
  const sales = [
    sale(2, '900003', 'NOK ONE 245/55R19', 1),
    sale(3, '900003', 'NOK ONE 215/70R16', 3)
  ]
  const first = planLines(
    sales,
    tires,
    {},
    { '900003': 'invoice.pdf' },
    {},
    new Set(),
    ['2026-09-01', '2026-09-30']
  )
  expect(first).toMatchObject([
    { status: 'needs-decision', qty: 4, rows: [2, 3], pdf: 'invoice.pdf' }
  ])
  const leftOut = planLines(sales, tires, {}, {}, {}, new Set([first[0]!.id]), [
    '2026-09-01',
    '2026-09-30'
  ])
  expect(leftOut[0]?.leftOut).toBe(true)
})

it('holds ready sales outside the inclusive program dates', () => {
  const lines = planLines(
    [
      sale(2, '900004', 'FAL AKLIMATE 205/60R16', 1, '2026-08-31'),
      sale(3, '900005', 'FAL AKLIMATE 205/60R16', 1, '2026-09-01')
    ],
    tires,
    {},
    {},
    {},
    new Set(),
    ['2026-09-01', '2026-09-30']
  )
  expect(lines[0]).toMatchObject({
    status: 'outside-dates',
    reason: expect.stringContaining('2026-09-30')
  })
  expect(lines[1]?.status).toBe('ready')
})

it('shows non-tire rows and applies session-only choices by wording', () => {
  const tube = {
    ...sale(2, '900006', '18X8.50/9.50-8 FST IMPORT TR13 TUBE', 1),
    notATire: 'tube' as const
  }
  const sales = [
    tube,
    sale(3, '900007', 'NOK ONE 245/55R19', 1),
    sale(4, '900008', 'NOK ONE 215/70R16', 2)
  ]
  const lines = planLines(
    sales,
    tires,
    {},
    {},
    { 'nokian|one': 'Nokian One HT - Light Truck Tires' },
    new Set(),
    [null, null]
  )
  expect(lines.map((line) => line.status)).toEqual([
    'not-a-tire',
    'ready',
    'ready'
  ])
})
