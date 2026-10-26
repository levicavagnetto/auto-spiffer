import { linkSales } from '../invoices/link'
import { collectPdfPaths, validateExportPath } from './paths'
import { readSalesExport } from './reader'
import type { InvoicePdf, SalesSnapshot, SalesState } from '../../shared/sales'

export class SalesSession {
  private state: SalesState | null = null

  constructor(
    private readonly readPdf: (path: string) => Promise<InvoicePdf>
  ) {}

  snapshot(warnings: string[] = []): SalesSnapshot | null {
    if (!this.state) return null
    const state = {
      ...this.state,
      sales: [...this.state.sales],
      unreadable: [...this.state.unreadable],
      pdfs: [...this.state.pdfs]
    }
    return { state, links: linkSales(state.sales, state.pdfs), warnings }
  }

  async loadExport(path: string): Promise<SalesSnapshot> {
    const valid = await validateExportPath(path)
    const state = await readSalesExport(valid)
    this.state = state
    return this.snapshot()!
  }

  async addPaths(paths: string[]): Promise<SalesSnapshot> {
    if (!this.state) throw new Error('Choose a Material Sales export first.')
    const collected = await collectPdfPaths(paths)
    const seen = new Set(this.state.pdfs.map((pdf) => pdf.path.toLowerCase()))
    for (const path of collected.paths) {
      if (seen.has(path.toLowerCase())) continue
      this.state.pdfs.push(await this.readPdf(path))
      seen.add(path.toLowerCase())
    }
    return this.snapshot(collected.warnings)!
  }

  removePdf(path: string): SalesSnapshot {
    if (!this.state) throw new Error('Choose a Material Sales export first.')
    this.state.pdfs = this.state.pdfs.filter((pdf) => pdf.path !== path)
    return this.snapshot()!
  }
}
