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

export type SiteLocation = 'login' | 'claim' | 'program-choice' | 'other'
export type ProgramChoice = 'selected' | 'missing' | 'ambiguous' | 'failed'

function chooseProgramInDocument(
  s: typeof selectors,
  month: string
): ProgramChoice {
  const select = document.querySelector<HTMLSelectElement>(s.programSelect)
  const widget = document.querySelector<HTMLElement>(s.programWidget)
  if (!select || !widget) return 'failed'
  const monthName = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${month}-01T00:00:00Z`))
  const options = Array.from(select.options).filter((option) =>
    option.text.toLowerCase().includes(monthName.toLowerCase())
  )
  if (!options.length) return 'missing'
  if (options.length > 1) return 'ambiguous'
  const option = options[0]!
  widget.querySelector<HTMLElement>('.chosen-single')?.click()
  widget
    .querySelector<HTMLElement>(
      `.chosen-results li[data-option-array-index="${option.index}"]`
    )
    ?.click()
  if (select.value !== option.value) {
    select.value = option.value
    select.dispatchEvent(new Event('change', { bubbles: true }))
    const jquery = (
      window as typeof window & {
        jQuery?: (element: Element) => { trigger: (event: string) => void }
      }
    ).jQuery
    jquery?.(select).trigger('chosen:updated')
  }
  return select.value === option.value ? 'selected' : 'failed'
}

function identifyDocument(required: readonly string[]): SiteLocation {
  if (document.querySelector('#UserLogin_Password')) return 'login'
  if (required.every((selector) => document.querySelector(selector)))
    return 'claim'
  if (
    document.querySelector('#DefaultContent_StepOneUpdatePanel') &&
    document.querySelector('#DefaultContent_PromotionDropDownList') &&
    document.querySelector('#DefaultContent_PromotionCodeNextLinkButton')
  )
    return 'program-choice'
  if (/\/authorized\/claims\/submitsale\.aspx$/i.test(location.pathname))
    return 'program-choice'
  return 'other'
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
  whereAmI: () => Promise<SiteLocation>
  fillLogin: (email: string, password: string) => Promise<void>
  chooseProgram: (month: string) => Promise<ProgramChoice>
  clickProgramNext: () => Promise<void>
  readPage: () => Promise<SitePage | null>
  guardedClick: (selector: string) => Promise<void>
  addLine: (line: AddLineInput) => Promise<AddOutcome>
  upload: (pdfPath: string) => Promise<void>
  screenshot: (name: string) => Promise<string>
  scrollTop: () => Promise<void>
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
      const lines = raw.lines.map((line) => ({
        ...line,
        saleDate: parseDate(line.saleDate)
      }))
      if (
        lines.some(
          (line) =>
            !line.saleDate ||
            Number.isNaN(line.saleDate.getTime()) ||
            !Number.isFinite(line.qty)
        )
      )
        throw new Error(
          'The claim page sale list could not be read. Check the page before entering sales.'
        )
      return {
        promotion: raw.promotion,
        window: [parseDate(raw.window[0]), parseDate(raw.window[1])],
        tires: raw.tires,
        lines: lines as SiteLine[]
      }
    }
  }
  return {
    ...driver,
    async fillLogin(email, password) {
      if ((await this.whereAmI()) !== 'login')
        throw new Error('The website is not on its sign-in page.')
      await webContents.executeJavaScript(`(() => {
        const email = document.querySelector(${JSON.stringify(selectors.loginEmail)});
        const password = document.querySelector(${JSON.stringify(selectors.loginPassword)});
        if (!(email instanceof HTMLInputElement) || !(password instanceof HTMLInputElement))
          throw new Error('Sign-in fields are missing.');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (!setter) throw new Error('Sign-in fields cannot be filled.');
        setter.call(email, ${JSON.stringify(email)});
        email.dispatchEvent(new Event('input', { bubbles: true }));
        setter.call(password, ${JSON.stringify(password)});
        password.dispatchEvent(new Event('input', { bubbles: true }));
      })()`)
      await driver.guardedClick(selectors.loginButton)
    },
    async chooseProgram(month) {
      if ((await this.whereAmI()) !== 'program-choice') return 'failed'
      return webContents.executeJavaScript(
        `(${chooseProgramInDocument.toString()})(${JSON.stringify(selectors)}, ${JSON.stringify(month)})`
      )
    },
    async clickProgramNext() {
      if ((await this.whereAmI()) !== 'program-choice')
        throw new Error('The website is not choosing a program.')
      const visible = await webContents.executeJavaScript(`(() => {
        const element = document.querySelector(${JSON.stringify(selectors.programNext)});
        return Boolean(element && getComputedStyle(element).display !== 'none' &&
          getComputedStyle(element).visibility !== 'hidden' && element.getClientRects().length);
      })()`)
      if (!visible) throw new Error('The program Next button is not visible.')
      await driver.guardedClick(selectors.programNext)
    },
    whereAmI: () =>
      webContents.executeJavaScript(
        `(${identifyDocument.toString()})(${JSON.stringify(requiredClaimSelectors)})`
      ),
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
    },
    async scrollTop() {
      await webContents.executeJavaScript('window.scrollTo(0, 0)')
    }
  }
}
