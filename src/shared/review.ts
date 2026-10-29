import { z } from 'zod'

export const suggestionSchema = z.object({
  label: z.string(),
  score: z.number(),
  reason: z.string()
})
export const reviewLineSchema = z.object({
  id: z.string(),
  saleDate: z.string(),
  invoice: z.string(),
  description: z.string(),
  qty: z.number().int().positive(),
  rows: z.array(z.number().int()),
  status: z.enum([
    'ready',
    'needs-decision',
    'not-eligible',
    'not-a-tire',
    'possible-wheel',
    'outside-dates'
  ]),
  tire: z.string().optional(),
  guess: z.string().optional(),
  suggestions: z.array(suggestionSchema),
  reason: z.string(),
  signature: z.string(),
  savedMatch: z.boolean(),
  pdf: z.string().optional(),
  leftOut: z.boolean(),
  readAs: z.object({
    brand: z.string().nullable(),
    sizes: z.array(z.string()),
    words: z.array(z.string())
  })
})
export type ReviewLine = z.infer<typeof reviewLineSchema>

export const reviewSnapshotSchema = z.object({
  lines: z.array(reviewLineSchema),
  tires: z.array(
    z.object({
      label: z.string(),
      brand: z.string(),
      model: z.string(),
      category: z.string().nullable(),
      kind: z.enum(['tire', 'wheel'])
    })
  ),
  promotion: z.string().nullable(),
  dates: z.tuple([z.string().nullable(), z.string().nullable()])
})
export type ReviewSnapshot = z.infer<typeof reviewSnapshotSchema>

export const savedChoiceSchema = z.object({
  label: z.string().nullable(),
  example: z.string().min(1),
  decidedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})
export const savedMatchesSchema = z.object({
  version: z.literal(1),
  entries: z.record(z.string(), savedChoiceSchema)
})
export type SavedMatches = z.infer<typeof savedMatchesSchema>
export const savedMatchListSchema = z.array(
  z.object({
    signature: z.string(),
    label: z.string().nullable(),
    example: z.string(),
    decidedOn: z.string(),
    inactive: z.boolean()
  })
)
export type SavedMatchList = z.infer<typeof savedMatchListSchema>
