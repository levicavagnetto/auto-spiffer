import { z } from 'zod'

export const updateStateSchema = z.object({
  phase: z.enum(['idle', 'checking', 'up-to-date', 'downloading', 'ready']),
  version: z.string(),
  readyVersion: z.string().nullable(),
  checkedAt: z.string().nullable(),
  automatic: z.boolean(),
  restartQueued: z.boolean()
})

export type UpdateState = z.output<typeof updateStateSchema>
