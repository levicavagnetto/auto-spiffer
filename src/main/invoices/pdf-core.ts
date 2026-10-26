import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { InvoicePdf } from '../../shared/sales'

const numberInText = /Invoice\s*#\s*(\d{3,})/gi
const numberInName = /(?<!\d)(\d{5,7})(?!\d)/

function mostFrequent(numbers: string[]): string | null {
  const counts = new Map<string, number>()
  for (const number of numbers)
    counts.set(number, (counts.get(number) ?? 0) + 1)
  let best: string | null = null
  for (const [number, count] of counts) {
    if (best === null || count > counts.get(best)!) best = number
  }
  return best
}

export async function readInvoiceCore(path: string): Promise<InvoicePdf> {
  const name = basename(path)
  let bytes: Buffer
  try {
    bytes = await readFile(path)
  } catch {
    return {
      path,
      name,
      invoice: null,
      fromFileName: false,
      notes: ['Could not read this PDF file.'],
      sha256: ''
    }
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  let text: string
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
      disableFontFace: true
    })
    try {
      const document = await task.promise
      const pages: string[] = []
      for (let number = 1; number <= document.numPages; number++) {
        const page = await document.getPage(number)
        const content = await page.getTextContent()
        pages.push(
          content.items
            .filter(
              (item): item is typeof item & { str: string } => 'str' in item
            )
            .map((item) => item.str)
            .join(' ')
        )
        page.cleanup()
      }
      text = pages.join('\n')
    } finally {
      await task.destroy()
    }
  } catch {
    return {
      path,
      name,
      invoice: null,
      fromFileName: false,
      notes: ['Could not read this file as a PDF.'],
      sha256
    }
  }
  const numbers = [...text.matchAll(numberInText)].map((match) => match[1]!)
  const inside = mostFrequent(numbers)
  const filename = numberInName.exec(name)?.[1] ?? null
  const notes: string[] = []
  if (inside && filename && inside !== filename)
    notes.push(
      `The file name says invoice ${filename}; the PDF says ${inside}.`
    )
  if (!inside && !filename) notes.push('No invoice number found')
  return {
    path,
    name,
    invoice: inside ?? filename,
    fromFileName: !inside && Boolean(filename),
    notes,
    sha256
  }
}
