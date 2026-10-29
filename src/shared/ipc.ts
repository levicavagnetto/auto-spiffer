import { z } from 'zod'
import { salesSnapshotSchema } from './sales'
import { reviewSnapshotSchema, savedMatchListSchema } from './review'
import { runStateSchema } from './run'
import { updateStateSchema } from './updates'

export const themeSchema = z.enum(['light', 'dark', 'system'])

export const credentialsStateSchema = z.object({
  email: z.string(),
  hasPassword: z.boolean(),
  staySignedIn: z.boolean()
})

export const settingsSchema = z.object({
  theme: themeSchema,
  automaticUpdates: z.boolean().default(true),
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
export const siteLocationSchema = z.enum([
  'login',
  'claim',
  'program-choice',
  'other'
])

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
  getCredentials: {
    name: 'getCredentials',
    input: z.undefined(),
    output: credentialsStateSchema
  },
  saveCredentials: {
    name: 'saveCredentials',
    input: z.object({ email: z.email(), password: z.string().min(1) }).strict(),
    output: credentialsStateSchema
  },
  setStaySignedIn: {
    name: 'setStaySignedIn',
    input: z.boolean(),
    output: credentialsStateSchema
  },
  forgetCredentials: {
    name: 'forgetCredentials',
    input: z.undefined(),
    output: credentialsStateSchema
  },
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
  getUpdateState: {
    name: 'getUpdateState',
    input: z.undefined(),
    output: updateStateSchema
  },
  checkForUpdates: {
    name: 'checkForUpdates',
    input: z.undefined(),
    output: updateStateSchema
  },
  setAutomaticUpdates: {
    name: 'setAutomaticUpdates',
    input: z.boolean(),
    output: updateStateSchema
  },
  restartToUpdate: {
    name: 'restartToUpdate',
    input: z.undefined(),
    output: updateStateSchema
  },
  openLogsFolder: {
    name: 'openLogsFolder',
    input: z.undefined(),
    output: z.undefined()
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
  getSiteLocation: {
    name: 'getSiteLocation',
    input: z.undefined(),
    output: siteLocationSchema
  },
  retrySignIn: {
    name: 'retrySignIn',
    input: z.undefined(),
    output: z.undefined()
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
  },
  getRunState: {
    name: 'getRunState',
    input: z.undefined(),
    output: runStateSchema
  },
  getRunLimit: {
    name: 'getRunLimit',
    input: z.undefined(),
    output: z.number().int().positive().nullable()
  },
  checkRunPage: {
    name: 'checkRunPage',
    input: z.undefined(),
    output: runStateSchema
  },
  startRun: { name: 'startRun', input: z.undefined(), output: runStateSchema },
  pauseRun: { name: 'pauseRun', input: z.undefined(), output: runStateSchema },
  resumeRun: {
    name: 'resumeRun',
    input: z.undefined(),
    output: runStateSchema
  },
  stopRun: { name: 'stopRun', input: z.undefined(), output: runStateSchema },
  openRunScreenshot: {
    name: 'openRunScreenshot',
    input: z.string().min(1).max(4096),
    output: z.undefined()
  }
} as const

export const events = {
  themeChanged: z.boolean(),
  appError: z.string(),
  progress: z.object({ current: z.number().int(), total: z.number().int() }),
  logLine: z.string(),
  siteStatusChanged: siteStatusSchema,
  signInAttention: z.string(),
  siteNeedsAttention: z.string(),
  runStateChanged: runStateSchema,
  updateStateChanged: updateStateSchema
} as const

export type CallName = keyof typeof calls
export type EventName = keyof typeof events
export type Settings = z.output<typeof settingsSchema>
export type Theme = z.output<typeof themeSchema>
export type CredentialsState = z.output<typeof credentialsStateSchema>
export type SiteStatus = z.output<typeof siteStatusSchema>
export type SiteLocation = z.output<typeof siteLocationSchema>
export type SitePage = z.output<typeof sitePageSchema>

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
