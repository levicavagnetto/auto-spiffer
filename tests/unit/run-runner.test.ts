import { expect, it, vi } from 'vitest'
import { runLines, type RunDriver } from '../../src/main/run/runner'
import { RunControl } from '../../src/main/run/control'
import type { ReviewLine } from '../../src/shared/review'
import type { SitePage } from '../../src/main/site/driver'
import type { AddOutcome } from '../../src/main/site/add-line'

const product = 'General Altimax RT45 - Passenger Tires'
const date = '2026-09-03'
const line = (
  id: string,
  invoice: string,
  qty = 1,
  pdf?: string,
  saleDate = date
): ReviewLine => ({
  id,
  invoice,
  qty,
  pdf,
  saleDate,
  tire: product,
  status: 'ready',
  leftOut: false,
  description: 'GEN RT45 205/55R16',
  rows: [2],
  suggestions: [],
  reason: '',
  signature: 'general|rt45',
  savedMatch: false,
  readAs: { brand: 'General', sizes: ['205/55R16'], words: ['RT45'] }
})
const dateObject = (value: string): Date => new Date(`${value}T00:00:00Z`)
const added = (): AddOutcome => ({
  kind: 'added',
  timing: { fillMs: 1, addMs: 1, method: 'direct' }
})

function fakeDriver(): RunDriver & {
  page: SitePage
  addLine: ReturnType<typeof vi.fn>
  upload: ReturnType<typeof vi.fn>
  screenshot: ReturnType<typeof vi.fn>
  scrollTop: ReturnType<typeof vi.fn>
} {
  const page: SitePage = {
    promotion: 'September 2026 Pro Rewards',
    window: [dateObject('2026-09-01'), dateObject('2026-09-30')],
    tires: [product],
    lines: []
  }
  const driver = {
    page,
    readPage: vi.fn(async () => page),
    addLine: vi.fn(
      async (input: {
        saleDate: Date
        invoice: string
        product: string
        qty: number
      }) => {
        page.lines.push({
          saleDate: input.saleDate,
          invoice: input.invoice,
          product: input.product,
          qty: input.qty
        })
        return added()
      }
    ),
    upload: vi.fn(async (path: string) => {
      void path
    }),
    screenshot: vi.fn(async (name: string) => {
      void name
      return 'logs/failed.png'
    }),
    scrollTop: vi.fn(async () => undefined)
  }
  return driver
}

it('enters in date then invoice order, checks each line, and uploads once per invoice', async () => {
  const driver = fakeDriver()
  const events: unknown[] = []
  const summary = await runLines(
    [
      line('c', '900003', 1, 'third.pdf', '2026-09-05'),
      line('b', '900001', 2, 'first.pdf'),
      line('a', '900001', 1, 'first.pdf', '2026-09-04')
    ],
    driver,
    new RunControl(),
    (event) => events.push(event)
  )
  expect(driver.addLine.mock.calls.map(([item]) => item.invoice)).toEqual([
    '900001',
    '900001',
    '900003'
  ])
  expect(driver.upload.mock.calls.map(([path]) => path)).toEqual([
    'first.pdf',
    'third.pdf'
  ])
  expect(summary.added).toEqual(['b', 'a', 'c'])
  expect(summary.failed).toEqual([])
  expect(events).toContainEqual(
    expect.objectContaining({ type: 'activity', kind: 'added' })
  )
  expect(driver.scrollTop).toHaveBeenCalledOnce()
})

it('skips an already entered line and refuses a different quantity', async () => {
  const driver = fakeDriver()
  driver.page.lines.push(
    { saleDate: dateObject(date), invoice: '900001', product, qty: 2 },
    { saleDate: dateObject(date), invoice: '900002', product, qty: 1 }
  )
  const summary = await runLines(
    [
      line('first', '900001', 2, 'first.pdf'),
      line('second', '900002', 4, 'second.pdf')
    ],
    driver,
    new RunControl(),
    vi.fn()
  )
  expect(summary.alreadyThere).toEqual(['first'])
  expect(summary.failed).toEqual([
    expect.objectContaining({
      lineId: 'second',
      reason: expect.stringContaining('already on the page with quantity 1')
    })
  ])
  expect(driver.addLine).not.toHaveBeenCalled()
  expect(driver.upload).not.toHaveBeenCalled()
})

it('fails closed if the sale list shows both expected and conflicting quantities', async () => {
  const driver = fakeDriver()
  driver.page.lines.push(
    { saleDate: dateObject(date), invoice: '900001', product, qty: 2 },
    { saleDate: dateObject(date), invoice: '900001', product, qty: 3 }
  )
  const summary = await runLines(
    [line('one', '900001', 2)],
    driver,
    new RunControl(),
    vi.fn()
  )
  expect(summary.failed[0]?.reason).toContain('quantity 3')
  expect(summary.alreadyThere).toEqual([])
  expect(driver.addLine).not.toHaveBeenCalled()
})

it('retries a failed Add once, then continues and saves a picture after two failures', async () => {
  const driver = fakeDriver()
  driver.addLine.mockResolvedValue({
    kind: 'rejected',
    message: 'The website rejected this line.',
    timing: { fillMs: 0, addMs: 0, method: 'none' }
  })
  const summary = await runLines(
    [line('first', '900001'), line('second', '900002')],
    driver,
    new RunControl(),
    vi.fn()
  )
  expect(driver.addLine).toHaveBeenCalledTimes(4)
  expect(summary.failed).toHaveLength(2)
  expect(summary.failed[0]).toMatchObject({
    lineId: 'first',
    screenshot: 'logs/failed.png',
    reason: 'The website rejected this line.'
  })
  expect(driver.screenshot).toHaveBeenCalledTimes(2)
})

it('does not retry a duplicate warning or upload its PDF', async () => {
  const driver = fakeDriver()
  driver.addLine.mockResolvedValue({
    kind: 'duplicate',
    message: 'The claim page says this sale was already entered.',
    timing: { fillMs: 0, addMs: 0, method: 'none' }
  })
  const summary = await runLines(
    [line('first', '900001', 1, 'one.pdf')],
    driver,
    new RunControl(),
    vi.fn()
  )
  expect(driver.addLine).toHaveBeenCalledOnce()
  expect(summary.failed[0]?.reason).toContain(
    'website says it is already entered'
  )
  expect(driver.upload).not.toHaveBeenCalled()
})

it('reports a failed upload and sales without PDFs while continuing', async () => {
  const driver = fakeDriver()
  driver.upload.mockRejectedValueOnce(new Error('Upload timed out'))
  const summary = await runLines(
    [line('first', '900001', 1, 'one.pdf'), line('second', '900002')],
    driver,
    new RunControl(),
    vi.fn()
  )
  expect(summary.added).toEqual(['first', 'second'])
  expect(summary.uploadFailed).toEqual([
    { invoice: '900001', reason: 'Upload timed out' }
  ])
  expect(summary.missingPdfs).toEqual(['900002'])
})
