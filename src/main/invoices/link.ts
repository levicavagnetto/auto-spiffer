import type { InvoicePdf, Sale } from '../../shared/sales'

export type InvoiceLinks = {
  usedByInvoice: Record<string, string>
  missingInvoices: string[]
  extraPdfs: InvoicePdf[]
  unlinkedPdfs: InvoicePdf[]
  unreadablePdfs: InvoicePdf[]
  duplicateInvoices: { invoice: string; names: string[] }[]
  identicalCopies: InvoicePdf[]
  loadedCount: number
  linkedCount: number
}

export function linkSales(sales: Sale[], pdfs: InvoicePdf[]): InvoiceLinks {
  const allInvoices = new Set(sales.map((sale) => sale.invoice))
  const tireInvoices = new Set(
    sales.filter((sale) => sale.notATire === null).map((sale) => sale.invoice)
  )
  const firstByInvoice = new Map<string, InvoicePdf>()
  const groups = new Map<string, InvoicePdf[]>()
  const identicalCopies: InvoicePdf[] = []
  const unlinkedPdfs: InvoicePdf[] = []
  const unreadablePdfs: InvoicePdf[] = []
  const extraPdfs: InvoicePdf[] = []
  const seenHashes = new Set<string>()

  for (const pdf of pdfs) {
    if (pdf.sha256 && seenHashes.has(pdf.sha256)) {
      identicalCopies.push(pdf)
      continue
    }
    if (pdf.sha256) seenHashes.add(pdf.sha256)
    if (pdf.notes.some((note) => note.startsWith('Could not read'))) {
      unreadablePdfs.push(pdf)
      continue
    }
    if (!pdf.invoice) {
      unlinkedPdfs.push(pdf)
      continue
    }
    if (!allInvoices.has(pdf.invoice)) extraPdfs.push(pdf)
    const group = groups.get(pdf.invoice) ?? []
    group.push(pdf)
    groups.set(pdf.invoice, group)
    if (!firstByInvoice.has(pdf.invoice)) firstByInvoice.set(pdf.invoice, pdf)
  }

  const usedByInvoice: Record<string, string> = {}
  const missingInvoices: string[] = []
  for (const invoice of [...tireInvoices].sort()) {
    const pdf = firstByInvoice.get(invoice)
    if (pdf) usedByInvoice[invoice] = pdf.path
    else missingInvoices.push(invoice)
  }
  const duplicateInvoices = [...groups]
    .filter(([, group]) => group.length > 1)
    .map(([invoice, group]) => ({
      invoice,
      names: group.map((pdf) => pdf.name)
    }))
  return {
    usedByInvoice,
    missingInvoices,
    extraPdfs,
    unlinkedPdfs,
    unreadablePdfs,
    duplicateInvoices,
    identicalCopies,
    loadedCount: pdfs.length,
    linkedCount: Object.keys(usedByInvoice).length
  }
}
