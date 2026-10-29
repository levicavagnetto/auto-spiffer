import { z } from 'zod'

export const invoicePdfSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  invoice: z.string().nullable(),
  fromFileName: z.boolean(),
  notes: z.array(z.string()),
  sha256: z.string()
})

export type NotATireReason = 'shipping' | 'tube' | 'no-size'

export const saleSchema = z.object({
  row: z.number().int().positive(),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  invoice: z.string().min(1),
  description: z.string().min(1),
  qty: z.number().int().positive(),
  notATire: z.enum(['shipping', 'tube', 'no-size']).nullable()
})

export type Sale = {
  row: number
  saleDate: string
  invoice: string
  description: string
  qty: number
  notATire: NotATireReason | null
}

export type InvoicePdf = z.infer<typeof invoicePdfSchema>

export type SalesState = {
  file: string
  sales: Sale[]
  unreadable: { row: number; why: string }[]
  month: string
  monthWarning?: string
  pdfs: InvoicePdf[]
}

export const salesStateSchema = z.object({
  file: z.string().min(1),
  sales: z.array(saleSchema),
  unreadable: z.array(
    z.object({ row: z.number().int().positive(), why: z.string() })
  ),
  month: z.string(),
  monthWarning: z.string().optional(),
  pdfs: z.array(invoicePdfSchema)
})

export const invoiceLinksSchema = z.object({
  usedByInvoice: z.record(z.string(), z.string()),
  missingInvoices: z.array(z.string()),
  extraPdfs: z.array(invoicePdfSchema),
  unlinkedPdfs: z.array(invoicePdfSchema),
  unreadablePdfs: z.array(invoicePdfSchema),
  duplicateInvoices: z.array(
    z.object({ invoice: z.string(), names: z.array(z.string()) })
  ),
  identicalCopies: z.array(invoicePdfSchema),
  loadedCount: z.number().int().nonnegative(),
  linkedCount: z.number().int().nonnegative()
})

export const salesSnapshotSchema = z.object({
  state: salesStateSchema,
  links: invoiceLinksSchema,
  warnings: z.array(z.string())
})

export type SalesSnapshot = z.infer<typeof salesSnapshotSchema>
