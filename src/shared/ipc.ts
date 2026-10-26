import { z } from 'zod'
import { salesSnapshotSchema } from './sales'
import { reviewSnapshotSchema, savedMatchListSchema } from './review'

export const themeSchema = z.enum(['light', 'dark', 'system'])

export const settingsSchema = z.object({
  theme: themeSchema,
  windowBounds: z.object({
    width: z.number().int().min(1100),
    height: z.number().int().min(700)
  })
})

const siteBoundsSchema = z
  .object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    width: z.number().int().min(1),
    height: z.number().int().min(1)
  })
  .strict()

export const siteStatusSchema = z.object({
  address: z.string(),
  state: z.enum(['notOpened', 'loading', 'ready', 'error'])
})

export const siteLineSchema = z.object({
  saleDate: z.date(),
  invoice: z.string(),
  product: z.string(),
  qty: z.number()
})

export const sitePageSchema = z.object({
  promotion: z.string().nullable(),
  window: z.tuple([z.date().nullable(), z.date().nullable()]),
  tires: z.array(z.string()),
  lines: z.array(siteLineSchema)
})

const testSaleSchema = z
  .object({
    saleDate: z.date(),
    invoice: z.string().trim().min(1).max(100),
    product: z.string().trim().min(1),
    qty: z.number().int().positive().max(1000)
  })
  .strict()

const addOutcomeSchema = z.object({
  kind: z.enum(['added', 'duplicate', 'rejected', 'mismatch', 'timeout']),
  message: z.string().optional(),
  timing: z.object({
    fillMs: z.number().nonnegative(),
    addMs: z.number().nonnegative(),
    method: z.enum(['direct', 'typed', 'none'])
  })
})

export const calls = {
  getSettings: {
    name: 'getSettings',
    input: z.undefined(),
    output: settingsSchema
  },
  setTheme: { name: 'setTheme', input: themeSchema, output: settingsSchema },
  getSystemTheme: {
    name: 'getSystemTheme',
    input: z.undefined(),
    output: z.boolean()
  },
  getAppVersion: {
    name: 'getAppVersion',
    input: z.undefined(),
    output: z.string()
  },
  setSiteBounds: {
    name: 'setSiteBounds',
    input: siteBoundsSchema.nullable(),
    output: z.undefined()
  },
  getSiteStatus: {
    name: 'getSiteStatus',
    input: z.undefined(),
    output: siteStatusSchema
  },
  reloadSite: {
    name: 'reloadSite',
    input: z.undefined(),
    output: z.undefined()
  },
  isClaimPage: {
    name: 'isClaimPage',
    input: z.undefined(),
    output: z.boolean()
  },
  readSitePage: {
    name: 'readSitePage',
    input: z.undefined(),
    output: sitePageSchema.nullable()
  },
  getLiveCheckAvailable: {
    name: 'getLiveCheckAvailable',
    input: z.undefined(),
    output: z.boolean()
  },
  testAddLine: {
    name: 'testAddLine',
    input: testSaleSchema,
    output: addOutcomeSchema
  },
  testUpload: {
    name: 'testUpload',
    input: z.string().min(1).max(4096),
    output: z.undefined()
  },
  getSalesSnapshot: {
    name: 'getSalesSnapshot',
    input: z.undefined(),
    output: salesSnapshotSchema.nullable()
  },
  pickSalesExport: {
    name: 'pickSalesExport',
    input: z.undefined(),
    output: salesSnapshotSchema.nullable()
  },
  loadSalesExport: {
    name: 'loadSalesExport',
    input: z.string().min(1).max(4096),
    output: salesSnapshotSchema
  },
  pickInvoicePdfs: {
    name: 'pickInvoicePdfs',
    input: z.undefined(),
    output: salesSnapshotSchema.nullable()
  },
  pickInvoiceFolder: {
    name: 'pickInvoiceFolder',
    input: z.undefined(),
    output: salesSnapshotSchema.nullable()
  },
  addInvoicePaths: {
    name: 'addInvoicePaths',
    input: z.array(z.string().min(1).max(4096)).max(1000),
    output: salesSnapshotSchema
  },
  removeInvoicePdf: {
    name: 'removeInvoicePdf',
    input: z.string().min(1).max(4096),
    output: salesSnapshotSchema
  },
  getReviewSnapshot: {
    name: 'getReviewSnapshot',
    input: z.undefined(),
    output: reviewSnapshotSchema.nullable()
  },
  matchTires: {
    name: 'matchTires',
    input: z.undefined(),
    output: reviewSnapshotSchema
  },
  decideTire: {
    name: 'decideTire',
    input: z
      .object({
        signature: z.string().min(1),
        label: z.string().nullable(),
        remember: z.boolean()
      })
      .strict(),
    output: reviewSnapshotSchema
  },
  setLineLeftOut: {
    name: 'setLineLeftOut',
    input: z.object({ id: z.string().min(1), leftOut: z.boolean() }).strict(),
    output: reviewSnapshotSchema
  },
  listSavedMatches: {
    name: 'listSavedMatches',
    input: z.undefined(),
    output: savedMatchListSchema
  },
  removeSavedMatch: {
    name: 'removeSavedMatch',
    input: z.string().min(1),
    output: z.undefined()
  }
} as const

export const events = {
  themeChanged: z.boolean(),
  appError: z.string(),
  progress: z.object({ current: z.number().int(), total: z.number().int() }),
  logLine: z.string(),
  siteStatusChanged: siteStatusSchema
} as const

export type CallName = keyof typeof calls
export type EventName = keyof typeof events
export type Settings = z.output<typeof settingsSchema>
export type Theme = z.output<typeof themeSchema>
export type SiteStatus = z.output<typeof siteStatusSchema>

export type CallHandlers = {
  [Name in CallName]: (
    input: z.output<(typeof calls)[Name]['input']>
  ) =>
    | z.input<(typeof calls)[Name]['output']>
    | Promise<z.input<(typeof calls)[Name]['output']>>
}

export type AppApi = {
  [Name in CallName]: (
    ...args: z.input<(typeof calls)[Name]['input']> extends undefined
      ? []
      : [input: z.input<(typeof calls)[Name]['input']>]
  ) => Promise<z.output<(typeof calls)[Name]['output']>>
} & {
  getPathForFile(file: File): string
  on<Name extends EventName>(
    event: Name,
    callback: (data: z.output<(typeof events)[Name]>) => void
  ): () => void
}
