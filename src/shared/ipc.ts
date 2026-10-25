import { z } from 'zod'

export const themeSchema = z.enum(['light', 'dark', 'system'])

export const settingsSchema = z.object({
  theme: themeSchema,
  windowBounds: z.object({
    width: z.number().int().min(1100),
    height: z.number().int().min(700)
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
  }
} as const

export const events = {
  themeChanged: z.boolean(),
  appError: z.string(),
  progress: z.object({ current: z.number().int(), total: z.number().int() }),
  logLine: z.string()
} as const

export type CallName = keyof typeof calls
export type EventName = keyof typeof events
export type Settings = z.output<typeof settingsSchema>
export type Theme = z.output<typeof themeSchema>

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
  on<Name extends EventName>(
    event: Name,
    callback: (data: z.output<(typeof events)[Name]>) => void
  ): () => void
}
