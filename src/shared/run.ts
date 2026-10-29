import { z } from 'zod'

export const pageCheckSchema = z.object({
  ok: z.boolean(),
  problems: z.array(z.string()),
  warnings: z.array(z.string()),
  program: z.string().nullable(),
  dates: z.tuple([z.string().nullable(), z.string().nullable()])
})
export const runSummarySchema = z.object({
  added: z.array(z.string()),
  alreadyThere: z.array(z.string()),
  failed: z.array(
    z.object({
      lineId: z.string(),
      invoice: z.string(),
      reason: z.string(),
      screenshot: z.string().optional()
    })
  ),
  uploaded: z.array(z.string()),
  uploadFailed: z.array(z.object({ invoice: z.string(), reason: z.string() })),
  missingPdfs: z.array(z.string()),
  stopped: z.boolean()
})
export const runEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('progress'),
    done: z.number().int(),
    total: z.number().int()
  }),
  z.object({ type: z.literal('now'), lineId: z.string() }),
  z.object({
    type: z.literal('activity'),
    lineId: z.string(),
    kind: z.enum([
      'added',
      'alreadyThere',
      'failed',
      'uploaded',
      'uploadFailed',
      'missingPdf'
    ]),
    text: z.string()
  }),
  z.object({ type: z.literal('finished'), summary: runSummarySchema })
])
export const runStateSchema = z.object({
  phase: z.enum(['idle', 'checking', 'running', 'paused', 'finished']),
  check: pageCheckSchema.nullable(),
  summary: runSummarySchema.nullable(),
  done: z.number().int(),
  total: z.number().int(),
  now: z.string().nullable(),
  activity: z.array(
    z.object({
      lineId: z.string(),
      kind: z.enum([
        'added',
        'alreadyThere',
        'failed',
        'uploaded',
        'uploadFailed',
        'missingPdf'
      ]),
      text: z.string()
    })
  )
})
export type RunState = z.infer<typeof runStateSchema>
export type RunEvent = z.infer<typeof runEventSchema>
