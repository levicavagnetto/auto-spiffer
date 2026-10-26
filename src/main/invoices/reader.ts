import { Worker } from 'node:worker_threads'
import { join } from 'node:path'
import { z } from 'zod'
import { invoicePdfSchema, type InvoicePdf } from '../../shared/sales'

const replySchema = z.object({
  id: z.number().int().nonnegative(),
  result: invoicePdfSchema.optional(),
  error: z.string().optional()
})

export class InvoiceWorker {
  private readonly worker: Worker
  private nextId = 0
  private readonly pending = new Map<
    number,
    {
      resolve: (result: InvoicePdf) => void
      reject: (error: Error) => void
    }
  >()
  private closed = false

  constructor(workerPath = join(__dirname, 'pdf-worker.js')) {
    this.worker = new Worker(workerPath)
    this.worker.on('message', (message: unknown) => {
      const reply = replySchema.safeParse(message)
      if (!reply.success) {
        this.failAll(new Error('The PDF reader returned an invalid result.'))
        return
      }
      const request = this.pending.get(reply.data.id)
      if (!request) return
      this.pending.delete(reply.data.id)
      if (reply.data.result) request.resolve(reply.data.result)
      else
        request.reject(
          new Error(reply.data.error || 'Could not read this PDF file.')
        )
    })
    this.worker.on('error', () =>
      this.failAll(new Error('The PDF reader stopped unexpectedly.'))
    )
    this.worker.on('exit', (code) => {
      if (!this.closed && code !== 0)
        this.failAll(new Error('The PDF reader stopped unexpectedly.'))
    })
    this.worker.unref()
  }

  private failAll(error: Error): void {
    for (const request of this.pending.values()) request.reject(error)
    this.pending.clear()
  }

  read(path: string): Promise<InvoicePdf> {
    if (this.closed)
      return Promise.reject(new Error('The PDF reader is closed.'))
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ id, path })
    })
  }

  async close(): Promise<void> {
    this.closed = true
    this.failAll(new Error('The PDF reader was closed.'))
    await this.worker.terminate()
  }
}
