import { parentPort } from 'node:worker_threads'
import { z } from 'zod'
import { readInvoiceCore } from './pdf-core'

const requestSchema = z.object({
  id: z.number().int().nonnegative(),
  path: z.string().min(1)
})

parentPort?.on('message', (input: unknown) => {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) return
  const { id, path } = parsed.data
  void readInvoiceCore(path).then(
    (result) => parentPort?.postMessage({ id, result }),
    () =>
      parentPort?.postMessage({ id, error: 'Could not read this PDF file.' })
  )
})
