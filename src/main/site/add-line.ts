import type { WebContents } from 'electron'
import type { SitePage } from './driver'
import { selectors } from './selectors'

export type AddLineInput = {
  saleDate: Date
  invoice: string
  product: string
  qty: number
}

export type AddOutcome = {
  kind: 'added' | 'duplicate' | 'rejected' | 'mismatch' | 'timeout'
  message?: string
  timing: { fillMs: number; addMs: number; method: 'direct' | 'typed' | 'none' }
}

type Dependencies = {
  isClaimPage: () => Promise<boolean>
  readPage: () => Promise<SitePage | null>
  guardedClick: (selector: string) => Promise<void>
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function pageDateKey(text: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim())
  if (!match) return null
  return `${match[3]}-${match[1]!.padStart(2, '0')}-${match[2]!.padStart(2, '0')}`
}

async function readBoxes(webContents: WebContents): Promise<{
  date: string
  invoice: string
  product: string
  qty: string
}> {
  return webContents.executeJavaScript(`(() => {
    const s = ${JSON.stringify(selectors)};
    const select = document.querySelector(s.product);
    return {
      date: document.querySelector(s.date)?.value ?? '',
      invoice: document.querySelector(s.invoice)?.value ?? '',
      product: select?.selectedOptions?.[0]?.text?.replace(/\\s+/g, ' ').trim() ?? '',
      qty: document.querySelector(s.qty)?.value ?? ''
    };
  })()`)
}

async function boxesMatch(
  webContents: WebContents,
  line: AddLineInput
): Promise<boolean> {
  const boxes = await readBoxes(webContents)
  return (
    pageDateKey(boxes.date) === dateKey(line.saleDate) &&
    boxes.invoice.trim() === line.invoice &&
    boxes.product === line.product &&
    boxes.qty.replace(/\D/g, '') === String(line.qty)
  )
}

async function fillDirect(
  webContents: WebContents,
  line: AddLineInput
): Promise<string | null> {
  const dateId = selectors.date.slice(1)
  const ids = [
    dateId,
    dateId.replace(/_dateInput$/, ''),
    selectors.invoice.slice(1),
    selectors.product.slice(1),
    selectors.qty.slice(1)
  ]
  const ymd = [
    line.saleDate.getUTCFullYear(),
    line.saleDate.getUTCMonth() + 1,
    line.saleDate.getUTCDate()
  ]
  return webContents.executeJavaScript(`(() => {
    try {
      const [dateId, pickerId, invoiceId, selectId, qtyId] = ${JSON.stringify(ids)};
      const ymd = ${JSON.stringify(ymd)};
      const invoice = ${JSON.stringify(line.invoice)};
      const label = ${JSON.stringify(line.product)};
      const qty = ${JSON.stringify(line.qty)};
      if (!window.$find || !window.jQuery) return 'the page has no controls to set';
      const dateBox = $find(dateId), picker = $find(pickerId);
      const invoiceBox = $find(invoiceId), qtyBox = $find(qtyId);
      const select = document.getElementById(selectId);
      if (!dateBox || !invoiceBox || !qtyBox || !select) return 'the boxes were not found as controls';
      const option = Array.from(select.options).find(o => o.text.replace(/\\s+/g, ' ').trim() === label);
      if (!option) return 'the tire is not in the list';
      const when = new Date(ymd[0], ymd[1] - 1, ymd[2]);
      if (picker?.get_dateInput?.()) picker.set_selectedDate(when);
      else dateBox.set_selectedDate(when);
      invoiceBox.set_value(invoice);
      select.value = option.value;
      jQuery(select).trigger('change').trigger('chosen:updated');
      qtyBox.set_value(qty);
      return null;
    } catch (error) { return String(error?.message ?? error); }
  })()`)
}

async function fillByTyping(
  webContents: WebContents,
  line: AddLineInput
): Promise<void> {
  const date = `${line.saleDate.getUTCMonth() + 1}/${line.saleDate.getUTCDate()}/${line.saleDate.getUTCFullYear()}`
  for (const [selector, value] of [
    [selectors.date, date],
    [selectors.invoice, line.invoice],
    [selectors.qty, String(line.qty)]
  ] as const) {
    await webContents.executeJavaScript(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      element.focus(); element.select();
    })()`)
    webContents.focus()
    await webContents.insertText(value)
    await webContents.executeJavaScript('document.activeElement.blur()')
  }
  await webContents.executeJavaScript(`(() => {
    const select = document.querySelector(${JSON.stringify(selectors.product)});
    const option = Array.from(select.options).find((o) =>
      o.text.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(line.product)});
    if (!option) return;
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if (window.jQuery) jQuery(select).trigger('chosen:updated');
  })()`)
}

async function pageSignals(webContents: WebContents): Promise<{
  duplicate: boolean
  validation: boolean
  message: string
  busy: boolean
  answered: number | null
}> {
  return webContents.executeJavaScript(`(() => {
    const s = ${JSON.stringify(selectors)};
    const visible = (selector) => {
      const el = document.querySelector(selector);
      return Boolean(el && !el.hidden && getComputedStyle(el).display !== 'none' &&
        getComputedStyle(el).visibility !== 'hidden');
    };
    let busy = false;
    try { busy = Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack(); } catch {}
    return {
      duplicate: visible(s.duplicatePopup),
      validation: visible(s.validationPopup),
      message: document.querySelector(s.validationPopup + ' .modal-body')?.textContent?.replace(/\\s+/g, ' ').trim()
        ?? document.querySelector(s.validationPopup)?.textContent?.replace(/\\s+/g, ' ').trim() ?? '',
      busy,
      answered: window.__spiffer?.answered ?? null
    };
  })()`)
}

async function installRequestCounter(webContents: WebContents): Promise<void> {
  await webContents.executeJavaScript(`(() => {
    if (window.__spiffer) return;
    let manager;
    try { manager = Sys.WebForms.PageRequestManager.getInstance(); } catch { return; }
    const counter = window.__spiffer = { answered: 0, began: 0, took: 0 };
    manager.add_beginRequest(() => { counter.began = performance.now(); });
    manager.add_endRequest(() => {
      counter.answered++;
      counter.took = performance.now() - counter.began;
    });
  })()`)
}

export async function addLine(
  webContents: WebContents,
  driver: Dependencies,
  line: AddLineInput
): Promise<AddOutcome> {
  const timing: AddOutcome['timing'] = { fillMs: 0, addMs: 0, method: 'none' }
  const outcome = (kind: AddOutcome['kind'], message?: string): AddOutcome => ({
    kind,
    message,
    timing
  })
  if (!(await driver.isClaimPage()))
    return outcome('rejected', 'Open the claim page first.')
  const before = await driver.readPage()
  if (!before) return outcome('rejected', 'Open the claim page first.')
  if (!before.tires.includes(line.product))
    return outcome('rejected', 'The tire is not on the claim page.')
  const key = dateKey(line.saleDate)
  if (
    before.lines.some(
      (row) =>
        dateKey(row.saleDate) === key &&
        row.invoice === line.invoice &&
        row.product === line.product
    )
  ) {
    return outcome('duplicate', 'This sale is already on the claim page.')
  }
  const idleDeadline = Date.now() + 5_000
  while ((await pageSignals(webContents)).busy) {
    if (Date.now() >= idleDeadline)
      return outcome('timeout', 'The claim page is still busy.')
    await sleep(50)
  }
  const filling = Date.now()
  const directReason = await fillDirect(webContents, line)
  if (directReason || !(await boxesMatch(webContents, line))) {
    timing.method = 'typed'
    await fillByTyping(webContents, line)
  } else timing.method = 'direct'
  timing.fillMs = Date.now() - filling
  if (!(await boxesMatch(webContents, line))) {
    return outcome(
      'rejected',
      'The claim page did not keep the sale details. Nothing was added.'
    )
  }
  const signals = await pageSignals(webContents)
  if (signals.duplicate || signals.validation)
    return outcome(
      'rejected',
      'Close the message on the claim page before adding a sale.'
    )
  await installRequestCounter(webContents)
  const answeredBefore = (await pageSignals(webContents)).answered
  const clicked = Date.now()
  await driver.guardedClick(selectors.add)
  let answerSeen: number | null = null
  while (Date.now() - clicked < 25_000) {
    try {
      const current = await pageSignals(webContents)
      if (current.duplicate) {
        await driver.guardedClick(selectors.duplicateNo)
        timing.addMs = Date.now() - clicked
        return outcome(
          'duplicate',
          'The claim page says this sale was already entered.'
        )
      }
      if (current.validation) {
        const message = current.message || 'The claim page rejected this sale.'
        const button = await webContents.executeJavaScript(`(() => {
          const panel = document.querySelector(${JSON.stringify(selectors.validationPopup)});
          const button = Array.from(panel?.querySelectorAll('button') ?? [])
            .find((candidate) => /^(ok|close|cancel)$/i.test(candidate.textContent?.trim() ?? ''));
          button?.setAttribute('data-spiffer-dismiss', 'true');
          return Boolean(button);
        })()`)
        if (button) {
          await driver.guardedClick('[data-spiffer-dismiss="true"]')
          await webContents.executeJavaScript(
            `document.querySelector('[data-spiffer-dismiss="true"]')?.removeAttribute('data-spiffer-dismiss')`
          )
        } else
          webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
        timing.addMs = Date.now() - clicked
        return outcome('rejected', message)
      }
      const read = await driver.readPage()
      const newRows =
        read?.lines.filter(
          (row) =>
            dateKey(row.saleDate) === key &&
            row.invoice === line.invoice &&
            row.product === line.product
        ) ?? []
      if (newRows.length) {
        timing.addMs = Date.now() - clicked
        if (newRows.some((row) => row.qty === line.qty)) return outcome('added')
        return outcome(
          'mismatch',
          `The claim page shows quantity ${newRows.at(-1)?.qty}, expected ${line.qty}.`
        )
      }
      if (
        answeredBefore !== null &&
        current.answered !== null &&
        current.answered > answeredBefore &&
        !current.busy
      ) {
        answerSeen ??= Date.now()
        if (Date.now() - answerSeen > 1_500) break
      }
    } catch {
      // A navigation during polling is treated as not answered yet.
    }
    await sleep(50)
  }
  timing.addMs = Date.now() - clicked
  return outcome('timeout', 'The claim page did not show the sale after Add.')
}
