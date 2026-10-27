import type { ReviewLine } from '../../shared/review'
import type { AddLineInput, AddOutcome } from '../site/add-line'
import type { SitePage } from '../site/driver'
import { RunControl } from './control'

export type RunDriver = {
  readPage(): Promise<SitePage | null>
  addLine(input: AddLineInput): Promise<AddOutcome>
  upload(path: string): Promise<void>
  screenshot(name: string): Promise<string>
  scrollTop(): Promise<void>
}
export type RunFailure = {
  lineId: string
  invoice: string
  reason: string
  screenshot?: string
}
export type RunSummary = {
  added: string[]
  alreadyThere: string[]
  failed: RunFailure[]
  uploaded: string[]
  uploadFailed: { invoice: string; reason: string }[]
  missingPdfs: string[]
  stopped: boolean
}
export type RunEvent =
  | { type: 'progress'; done: number; total: number }
  | { type: 'now'; lineId: string }
  | {
      type: 'activity'
      lineId: string
      kind:
        | 'added'
        | 'alreadyThere'
        | 'failed'
        | 'uploaded'
        | 'uploadFailed'
        | 'missingPdf'
      text: string
    }
  | { type: 'finished'; summary: RunSummary }

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
function key(date: Date): string {
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}
function matching(page: SitePage, line: ReviewLine): SitePage['lines'] {
  return page.lines.filter(
    (item) =>
      key(item.saleDate) === line.saleDate &&
      item.invoice === line.invoice &&
      item.product === line.tire
  )
}

export async function runLines(
  lines: ReviewLine[],
  driver: RunDriver,
  control: RunControl,
  emit: (event: RunEvent) => void
): Promise<RunSummary> {
  const summary: RunSummary = {
    added: [],
    alreadyThere: [],
    failed: [],
    uploaded: [],
    uploadFailed: [],
    missingPdfs: [],
    stopped: false
  }
  const groups = new Map<string, ReviewLine[]>()
  for (const line of lines)
    groups.set(line.invoice, [...(groups.get(line.invoice) ?? []), line])
  const ordered = [...groups.entries()].sort(
    ([a, al], [b, bl]) =>
      Math.min(...al.map((item) => Date.parse(item.saleDate))) -
        Math.min(...bl.map((item) => Date.parse(item.saleDate))) ||
      a.localeCompare(b)
  )
  let done = 0
  emit({ type: 'progress', done, total: lines.length })
  try {
    for (const [invoice, batch] of ordered) {
      batch.sort(
        (a, b) =>
          a.saleDate.localeCompare(b.saleDate) || a.id.localeCompare(b.id)
      )
      let addedInGroup = false
      for (const line of batch) {
        if (!(await control.checkpoint())) break
        emit({ type: 'now', lineId: line.id })
        const activity = (
          kind: Extract<RunEvent, { type: 'activity' }>['kind'],
          text: string
        ): void => emit({ type: 'activity', lineId: line.id, kind, text })
        let failure: string | null = null
        try {
          if (!line.tire)
            throw new Error('Choose a tire for this sale before entering it.')
          const page = await driver.readPage()
          if (!page)
            throw new Error('Open the claim page in the ProRewards tab.')
          const rows = matching(page, line)
          if (rows.some((row) => row.qty !== line.qty)) {
            failure = `Invoice ${invoice} is already on the page with quantity ${rows.find((row) => row.qty !== line.qty)!.qty}. Check it by hand.`
          } else if (rows.some((row) => row.qty === line.qty)) {
            summary.alreadyThere.push(line.id)
            activity(
              'alreadyThere',
              `Invoice ${invoice}: already on the claim page.`
            )
          } else {
            const input: AddLineInput = {
              saleDate: new Date(`${line.saleDate}T00:00:00Z`),
              invoice,
              product: line.tire,
              qty: line.qty
            }
            for (let attempt = 0; attempt < 2; attempt++) {
              const result = await driver.addLine(input)
              const after = await driver.readPage()
              const afterRows = after ? matching(after, line) : []
              if (afterRows.some((row) => row.qty !== line.qty)) {
                failure = `Invoice ${invoice} is on the page with a different quantity. Check it by hand.`
                break
              }
              if (afterRows.some((row) => row.qty === line.qty)) {
                summary.added.push(line.id)
                addedInGroup = true
                activity('added', `Invoice ${invoice}: sale added.`)
                failure = null
                break
              }
              if (result.kind === 'duplicate') {
                failure = `The website says it is already entered, but the sale is not visible. Check invoice ${invoice} by hand.`
                break
              }
              if (result.kind === 'mismatch') {
                failure =
                  result.message ??
                  'The website showed a different quantity. Check it by hand.'
                break
              }
              failure = result.message ?? 'The website did not add this sale.'
              if (!after) break
            }
          }
        } catch (error) {
          failure = errorText(error)
        }
        if (failure) {
          const record: RunFailure = {
            lineId: line.id,
            invoice,
            reason: failure
          }
          try {
            record.screenshot = await driver.screenshot(`failed-${invoice}`)
          } catch {
            /* A missing picture must not hide the failure. */
          }
          summary.failed.push(record)
          activity('failed', `Invoice ${invoice}: ${failure}`)
        }
        done++
        emit({ type: 'progress', done, total: lines.length })
      }
      if (addedInGroup) {
        const pdf = batch.find((line) => line.pdf)?.pdf
        if (pdf) {
          try {
            await driver.upload(pdf)
            summary.uploaded.push(invoice)
            emit({
              type: 'activity',
              lineId: batch[0]!.id,
              kind: 'uploaded',
              text: `Invoice ${invoice}: PDF uploaded.`
            })
          } catch (error) {
            summary.uploadFailed.push({ invoice, reason: errorText(error) })
            emit({
              type: 'activity',
              lineId: batch[0]!.id,
              kind: 'uploadFailed',
              text: `Invoice ${invoice}: PDF upload failed. Upload it by hand.`
            })
          }
        } else {
          summary.missingPdfs.push(invoice)
          emit({
            type: 'activity',
            lineId: batch[0]!.id,
            kind: 'missingPdf',
            text: `Invoice ${invoice}: no PDF selected. Upload it by hand.`
          })
        }
      }
      if (control.isStopped) break
    }
  } finally {
    summary.stopped = control.isStopped
    try {
      await driver.scrollTop()
    } catch {
      /* Navigation may have closed the page. */
    }
    emit({ type: 'finished', summary })
  }
  return summary
}
