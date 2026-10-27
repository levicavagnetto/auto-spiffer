import { expect, it, vi } from 'vitest'
import { RunSession } from '../../src/main/run/session'
import type { ReviewSnapshot } from '../../src/shared/review'
import type { SitePage } from '../../src/main/site/driver'

it('rejects a second run while one line is still being entered', async () => {
  const tire = 'Nokian Remedy WRG5 - Passenger Tires'
  const review = {
    lines: [
      {
        id: 'one',
        saleDate: '2026-10-18',
        invoice: '900001',
        description: 'NOK REMEDY',
        qty: 1,
        rows: [2],
        status: 'ready',
        tire,
        suggestions: [],
        reason: '',
        signature: 'nokian|remedy',
        savedMatch: false,
        leftOut: false,
        readAs: { brand: 'Nokian', sizes: [], words: [] }
      }
    ],
    tires: [],
    promotion: 'October 2026 Pro Rewards',
    dates: ['2026-10-01', '2026-10-31']
  } as ReviewSnapshot
  const page: SitePage = {
    promotion: 'October 2026 Pro Rewards',
    window: [new Date('2026-10-01'), new Date('2026-10-31')],
    tires: [tire],
    lines: []
  }
  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const driver = {
    readPage: vi.fn(async () => page),
    addLine: vi.fn(
      async (input: {
        saleDate: Date
        invoice: string
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
    ),
    upload: vi.fn(async () => undefined),
    screenshot: vi.fn(async () => ''),
    scrollTop: vi.fn(async () => undefined)
  }
  const session = new RunSession({
    review: () => review,
    month: () => '2026-10',
    readPage: () => driver.readPage(),
    driver,
    publish: vi.fn()
  })
  expect((await session.start()).phase).toBe('running')
  await expect(session.start()).rejects.toThrow('already in progress')
  expect(driver.addLine).toHaveBeenCalledOnce()
  release()
  await vi.waitFor(() => expect(session.snapshot().phase).toBe('finished'))
  expect(session.snapshot().summary?.added).toEqual(['one'])
})
