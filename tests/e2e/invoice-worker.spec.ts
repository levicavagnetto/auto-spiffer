import { expect, test } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { Worker } from 'node:worker_threads'
import { InvoiceWorker } from '../../src/main/invoices/reader'

test('invoice PDF is read in a worker thread', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'auto-spiffer-worker-'))
  const file = join(folder, 'invoice.pdf')
  const document = await PDFDocument.create()
  const page = document.addPage()
  const font = await document.embedFont(StandardFonts.Helvetica)
  page.drawText('Invoice # 900301', { x: 60, y: 700, font })
  writeFileSync(file, await document.save())
  const worker = new Worker(resolve('out/main/pdf-worker.js'))
  try {
    const result = await new Promise<{
      id: number
      result?: { invoice: string }
      error?: string
    }>((resolveResult, reject) => {
      worker.once('message', resolveResult)
      worker.once('error', reject)
      worker.postMessage({ id: 1, path: file })
    })
    expect(result).toMatchObject({ id: 1, result: { invoice: '900301' } })
  } finally {
    await worker.terminate()
    rmSync(folder, { recursive: true, force: true })
  }
})

test('main-process wrapper receives the worker result', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'auto-spiffer-worker-'))
  const file = join(folder, '900302.pdf')
  const document = await PDFDocument.create()
  document.addPage().drawText('Receipt', { x: 60, y: 700 })
  writeFileSync(file, await document.save())
  const reader = new InvoiceWorker(resolve('out/main/pdf-worker.js'))
  try {
    expect(await reader.read(file)).toMatchObject({
      invoice: '900302',
      fromFileName: true
    })
  } finally {
    await reader.close()
    rmSync(folder, { recursive: true, force: true })
  }
})
