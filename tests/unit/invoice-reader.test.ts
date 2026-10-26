import { afterEach, describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readInvoiceCore } from '../../src/main/invoices/pdf-core'

const folders: string[] = []
function fixturePath(name: string): string {
  const folder = mkdtempSync(join(tmpdir(), 'auto-spiffer-pdf-'))
  folders.push(folder)
  return join(folder, name)
}

async function writePdf(path: string, lines: string[]): Promise<void> {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  for (const text of lines) {
    const page = document.addPage()
    page.drawText(text, { x: 60, y: 700, size: 12, font })
  }
  writeFileSync(path, await document.save())
}

afterEach(() => {
  for (const folder of folders.splice(0))
    rmSync(folder, { recursive: true, force: true })
})

describe('readInvoiceCore', () => {
  it('uses the most frequent invoice number inside all PDF pages', async () => {
    const path = fixturePath('scan 12.pdf')
    await writePdf(path, [
      'Invoice # 900101',
      'Invoice # 900102',
      'Invoice # 900101'
    ])
    const pdf = await readInvoiceCore(path)
    expect(pdf).toMatchObject({
      invoice: '900101',
      fromFileName: false,
      notes: []
    })
    expect(pdf.sha256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('uses the file name only when the PDF has no invoice number', async () => {
    const path = fixturePath('900201.pdf')
    await writePdf(path, ['Thank you for your purchase'])
    expect(await readInvoiceCore(path)).toMatchObject({
      invoice: '900201',
      fromFileName: true
    })
  })

  it('trusts the PDF text and notes a different number in the name', async () => {
    const path = fixturePath('900299.pdf')
    await writePdf(path, ['Invoice # 900202'])
    const pdf = await readInvoiceCore(path)
    expect(pdf.invoice).toBe('900202')
    expect(pdf.notes.join(' ')).toContain('900299')
  })

  it('leaves an unnumbered PDF unlinked', async () => {
    const path = fixturePath('scan.pdf')
    await writePdf(path, ['Thank you'])
    expect(await readInvoiceCore(path)).toMatchObject({
      invoice: null,
      notes: ['No invoice number found']
    })
  })

  it('reports an unreadable PDF without stopping the other files', async () => {
    const path = fixturePath('broken.pdf')
    writeFileSync(path, 'not a PDF')
    expect(await readInvoiceCore(path)).toMatchObject({
      invoice: null,
      notes: [expect.stringContaining('Could not read')]
    })
  })
})
