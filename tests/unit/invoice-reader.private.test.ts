import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { readInvoiceCore } from '../../src/main/invoices/pdf-core'

const path = resolve('private-data/legacy-fixtures/example_invoice.pdf')

test.skipIf(!existsSync(path))(
  'real invoice has a readable number',
  async () => {
    const result = await readInvoiceCore(path)
    expect(result.invoice).toMatch(/^\d{3,}$/)
    expect(result.fromFileName).toBe(false)
  }
)
