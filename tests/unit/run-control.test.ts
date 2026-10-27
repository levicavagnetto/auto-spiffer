import { expect, it, vi } from 'vitest'
import { RunControl } from '../../src/main/run/control'
import { runLines } from '../../src/main/run/runner'
import type { ReviewLine } from '../../src/shared/review'
import type { SitePage } from '../../src/main/site/driver'

const tire = 'General Altimax RT45 - Passenger Tires'
function line(id: string): ReviewLine {
  return {
    id,
    saleDate: '2026-09-03',
    invoice: id,
    description: 'RT45',
    qty: 1,
    rows: [2],
    status: 'ready',
    tire,
    suggestions: [],
    reason: '',
    signature: id,
    savedMatch: false,
    leftOut: false,
    readAs: { brand: 'General', sizes: [], words: [] },
    pdf: `${id}.pdf`
  }
}
const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

it('pauses between lines and resumes', async () => {
  const control = new RunControl()
  const page: SitePage = {
    promotion: 'September 2026 Pro Rewards',
    window: [null, null],
    tires: [tire],
    lines: []
  }
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const addLine = vi.fn(
    async (input: {
      invoice: string
      saleDate: Date
      product: string
      qty: number
    }) => {
      if (input.invoice === 'a') await gate
      page.lines.push(input)
      return {
        kind: 'added' as const,
        timing: { fillMs: 1, addMs: 1, method: 'direct' as const }
      }
    }
  )
  const driver = {
    readPage: vi.fn(async () => page),
    addLine,
    upload: vi.fn(async () => undefined),
    screenshot: vi.fn(async () => ''),
    scrollTop: vi.fn(async () => undefined)
  }
  const run = runLines([line('a'), line('b')], driver, control, vi.fn())
  await tick()
  control.pause()
  release()
  await tick()
  expect(addLine).toHaveBeenCalledTimes(1)
  expect(driver.upload).toHaveBeenCalledWith('a.pdf')
  control.resume()
  expect((await run).added).toEqual(['a', 'b'])
})

it('stops after the current line and still uploads its invoice', async () => {
  const control = new RunControl()
  const page: SitePage = {
    promotion: 'September 2026 Pro Rewards',
    window: [null, null],
    tires: [tire],
    lines: []
  }
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const addLine = vi.fn(
    async (input: {
      invoice: string
      saleDate: Date
      product: string
      qty: number
    }) => {
      await gate
      page.lines.push(input)
      return {
        kind: 'added' as const,
        timing: { fillMs: 1, addMs: 1, method: 'direct' as const }
      }
    }
  )
  const driver = {
    readPage: vi.fn(async () => page),
    addLine,
    upload: vi.fn(async () => undefined),
    screenshot: vi.fn(async () => ''),
    scrollTop: vi.fn(async () => undefined)
  }
  const run = runLines([line('a'), line('b')], driver, control, vi.fn())
  await tick()
  control.stop()
  release()
  const summary = await run
  expect(summary).toMatchObject({
    added: ['a'],
    stopped: true,
    uploaded: ['a']
  })
  expect(addLine).toHaveBeenCalledOnce()
})
