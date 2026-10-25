import type { WebContents } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { requiredClaimSelectors, selectors } from './selectors'
import { neverClickSelectors } from './selectors'
import { assertAllowedClick } from './click-guard'
import { addLine, type AddLineInput, type AddOutcome } from './add-line'
import { uploadPdf } from './upload'

type RawLine = {
  saleDate: string
  invoice: string
  product: string
  qty: number
}
type RawPage = {
  promotion: string | null
  window: [string | null, string | null]
  tires: string[]
  lines: RawLine[]
}

export type SiteLine = {
  saleDate: Date
  invoice: string
  product: string
  qty: number
}

export type SitePage = {
  promotion: string | null
  window: [Date | null, Date | null]
  tires: string[]
  lines: SiteLine[]
}

function readDocument(s: typeof selectors): RawPage {
  const squeeze = (text: string): string => text.replace(/\s+/g, ' ').trim()
  const heading = squeeze(document.body.innerText).match(
    /Promotion Name:\s*(.*?)\s*\((\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})\)/i
  )
  const state = document.querySelector<HTMLInputElement>(s.dateState)?.value
  let dates: [string | null, string | null] = [null, null]
  if (state) {
    try {
      const parsed = JSON.parse(state) as {
        minDateStr?: string
        maxDateStr?: string
      }
      dates = [
        parsed.minDateStr?.slice(0, 10) ?? null,
        parsed.maxDateStr?.slice(0, 10) ?? null
      ]
    } catch {
      // A damaged client state leaves the range unknown.
    }
  }
  const select = document.querySelector<HTMLSelectElement>(s.product)
  const tires = Array.from(select?.options ?? [])
    .map((option) => squeeze(option.text))
    .filter((label) => label && label.toLowerCase() !== 'select one')
  const grid = document.querySelector<HTMLTableElement>(s.grid)
  const headers = Array.from(grid?.querySelectorAll('thead th') ?? []).map(
    (cell) => squeeze(cell.textContent ?? '').toLowerCase()
  )
  const column = (name: RegExp, fallback: number): number => {
    const found = headers.findIndex((header) => name.test(header))
    return found >= 0 ? found : fallback
  }
  const dateColumn = column(/sale date/, 1)
  const invoiceColumn = column(/invoice/, 2)
  const productColumn = column(/product/, 3)
  const qtyColumn = column(/qty|quantity/, 4)
  const lines = Array.from(grid?.querySelectorAll('tbody tr') ?? [])
    .filter((row) => !row.classList.contains('rgNoRecords'))
    .map((row) =>
      Array.from(row.querySelectorAll(':scope > td')).map((cell) =>
        squeeze(cell.textContent ?? '')
      )
    )
    .filter((cells) => cells.length >= 4)
    .map((cells) => ({
      saleDate: cells[dateColumn] ?? '',
      invoice: cells[invoiceColumn] ?? '',
      product: cells[productColumn] ?? '',
      qty: Number(cells[qtyColumn])
    }))
  return { promotion: heading?.[1] ?? null, window: dates, tires, lines }
}

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (iso) return new Date(Date.UTC(+iso[1]!, +iso[2]! - 1, +iso[3]!))
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  if (us) return new Date(Date.UTC(+us[3]!, +us[1]! - 1, +us[2]!))
  return null
}

export function createSiteDriver(
  webContents: WebContents,
  log: (message: string) => void,
  logsFolder: string
): {
  isClaimPage: () => Promise<boolean>
  readPage: () => Promise<SitePage | null>
  guardedClick: (selector: string) => Promise<void>
  addLine: (line: AddLineInput) => Promise<AddOutcome>
  upload: (pdfPath: string) => Promise<void>
  screenshot: (name: string) => Promise<string>
} {
  const isClaimPage = (): Promise<boolean> =>
    webContents.executeJavaScript(
      `(${(required: string[]) => required.every((selector) => document.querySelector(selector))})(${JSON.stringify(requiredClaimSelectors)})`
    )
  const driver = {
    isClaimPage,
    async guardedClick(selector: string) {
      try {
        assertAllowedClick(selector, '', false, false, neverClickSelectors)
        await webContents.executeJavaScript(`(() => {
          const selector = ${JSON.stringify(selector)};
          const forbidden = ${JSON.stringify(neverClickSelectors)};
          const required = ${JSON.stringify(requiredClaimSelectors)};
          const element = document.querySelector(selector);
          if (!element) throw new Error('The page control was not found.');
          const label = element instanceof HTMLInputElement ? element.value : (element.textContent || '');
          const banned = forbidden.some((item) =>
            element.matches(item) || Boolean(element.closest(item)) || Boolean(element.querySelector(item))
          );
          const onClaimPage = required.every((item) => document.querySelector(item));
          (${assertAllowedClick.toString()})(selector, label, onClaimPage, banned, forbidden);
          element.click();
        })()`)
      } catch (error) {
        log(`Site click failed for ${selector}: ${String(error)}`)
        throw error
      }
    },
    async readPage(): Promise<SitePage | null> {
      if (!(await isClaimPage())) return null
      const raw = (await webContents.executeJavaScript(
        `(${readDocument.toString()})(${JSON.stringify(selectors)})`
      )) as RawPage
      return {
        promotion: raw.promotion,
        window: [parseDate(raw.window[0]), parseDate(raw.window[1])],
        tires: raw.tires,
        lines: raw.lines.map((line) => ({
          ...line,
          saleDate: parseDate(line.saleDate)!
        }))
      }
    }
  }
  return {
    ...driver,
    async addLine(line: AddLineInput) {
      const result = await addLine(webContents, driver, line)
      log(
        `Site Add ${result.kind}: fill ${result.timing.fillMs} ms, Add ${result.timing.addMs} ms, method ${result.timing.method}`
      )
      return result
    },
    async upload(pdfPath: string) {
      const started = Date.now()
      try {
        await uploadPdf(webContents, isClaimPage, pdfPath)
        log(`Site upload completed in ${Date.now() - started} ms`)
      } catch (error) {
        log(
          `Site upload failed after ${Date.now() - started} ms: ${String(error)}`
        )
        throw error
      }
    },
    async screenshot(name: string) {
      const safeName =
        name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'page'
      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace('T', '-')
        .replace('Z', '')
      const file = join(logsFolder, `${stamp}-${safeName}.png`)
      const image = await webContents.capturePage()
      await writeFile(file, image.toPNG())
      return file
    }
  }
}
