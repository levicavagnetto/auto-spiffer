import { describe, expect, it } from 'vitest'
import { linkSales } from '../../src/main/invoices/link'
import type { InvoicePdf, Sale } from '../../src/shared/sales'

const sale = (
  invoice: string,
  row: number,
  notATire: Sale['notATire'] = null
): Sale => ({
  row,
  saleDate: '2026-09-03',
  invoice,
  description: '235/50R18 GEN RT45',
  qty: 1,
  notATire
})
const pdf = (
  invoice: string | null,
  name: string,
  sha256 = name
): InvoicePdf => ({
  path: `C:\\PDFs\\${name}`,
  name,
  invoice,
  fromFileName: false,
  notes: [],
  sha256
})

describe('linkSales', () => {
  it('links each tire sale and lists missing PDFs by invoice', () => {
    const result = linkSales(
      [
        sale('900401', 2),
        sale('900401', 3),
        sale('900402', 4),
        sale('900403', 5, 'tube')
      ],
      [pdf('900401', 'one.pdf')]
    )
    expect(result.usedByInvoice).toEqual({ '900401': 'C:\\PDFs\\one.pdf' })
    expect(result.missingInvoices).toEqual(['900402'])
    expect(result.linkedCount).toBe(1)
    expect(result.loadedCount).toBe(1)
  })

  it('lists PDFs absent from the sales and keeps the first of two for one invoice', () => {
    const result = linkSales(
      [sale('900411', 2)],
      [
        pdf('900411', 'first.pdf'),
        pdf('900411', 'second.pdf'),
        pdf('900499', 'extra.pdf')
      ]
    )
    expect(result.usedByInvoice['900411']).toContain('first.pdf')
    expect(result.duplicateInvoices).toEqual([
      { invoice: '900411', names: ['first.pdf', 'second.pdf'] }
    ])
    expect(result.extraPdfs.map((item) => item.name)).toEqual(['extra.pdf'])
  })

  it('does not link the same file twice, even under another name', () => {
    const result = linkSales(
      [sale('900421', 2)],
      [
        pdf('900421', 'first.pdf', 'same-hash'),
        pdf('900421', 'copy.pdf', 'same-hash')
      ]
    )
    expect(result.loadedCount).toBe(2)
    expect(result.linkedCount).toBe(1)
    expect(result.identicalCopies.map((item) => item.name)).toEqual([
      'copy.pdf'
    ])
    expect(result.duplicateInvoices).toEqual([])
  })

  it('reports a PDF with no invoice number without linking it', () => {
    const result = linkSales([sale('900431', 2)], [pdf(null, 'scan.pdf')])
    expect(result.missingInvoices).toEqual(['900431'])
    expect(result.unlinkedPdfs.map((item) => item.name)).toEqual(['scan.pdf'])
  })

  it('lists a damaged PDF as unreadable', () => {
    const damaged = {
      ...pdf(null, 'broken.pdf'),
      notes: ['Could not read this file as a PDF.']
    }
    const result = linkSales([sale('900432', 2)], [damaged])
    expect(result.unreadablePdfs.map((item) => item.name)).toEqual([
      'broken.pdf'
    ])
    expect(result.unlinkedPdfs).toEqual([])
  })
})
