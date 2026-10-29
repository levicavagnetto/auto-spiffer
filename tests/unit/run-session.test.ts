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
      },
      {
        id: 'wheel',
        saleDate: '2026-10-18',
        invoice: '900002',
        description: 'STYLE A 20X10 -12 5X5.00 BLACK',
        qty: 1,
        rows: [3],
        status: 'possible-wheel',
        suggestions: [],
        reason: 'Possible wheel.',
        signature: 'row|3',
        savedMatch: false,
        leftOut: false,
        readAs: { brand: null, sizes: [], words: [] }
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
    ensurePage: vi.fn(async () => undefined),
    driver,
    publish: vi.fn()
  })
  expect((await session.start()).phase).toBe('running')
  await expect(session.start()).rejects.toThrow('already in progress')
  expect(driver.addLine).toHaveBeenCalledOnce()
  release()
  await vi.waitFor(() => expect(session.snapshot().phase).toBe('finished'))
  expect(session.snapshot().summary?.added).toEqual(['one'])
  expect(driver.addLine).toHaveBeenCalledOnce()
})

it('returns to the intended claim page before checking and before starting', async () => {
  const ensurePage = vi.fn(async () => undefined)
  const driver = {
    readPage: vi.fn(async () => null),
    addLine: vi.fn(),
    upload: vi.fn(),
    screenshot: vi.fn(),
    scrollTop: vi.fn()
  }
  const session = new RunSession({
    review: () =>
      ({
        lines: [],
        tires: [],
        promotion: null,
        dates: null
      }) as unknown as ReviewSnapshot,
    month: () => '2026-10',
    ensurePage,
    readPage: driver.readPage,
    driver,
    publish: vi.fn()
  })
  await session.check()
  await session.start()
  expect(ensurePage).toHaveBeenCalledTimes(2)
  expect(driver.addLine).not.toHaveBeenCalled()
})

it('does not enter sales when claim-page recovery fails before Start', async () => {
  const driver = {
    readPage: vi.fn(async () => null),
    addLine: vi.fn(),
    upload: vi.fn(),
    screenshot: vi.fn(),
    scrollTop: vi.fn()
  }
  const session = new RunSession({
    review: () =>
      ({
        lines: [],
        tires: [],
        promotion: null,
        dates: null
      }) as unknown as ReviewSnapshot,
    month: () => '2026-10',
    ensurePage: async () => {
      throw new Error('Open the October claim page in ProRewards.')
    },
    readPage: driver.readPage,
    driver,
    publish: vi.fn()
  })
  await expect(session.start()).rejects.toThrow('Open the October claim page')
  expect(session.snapshot().phase).toBe('idle')
  expect(driver.readPage).not.toHaveBeenCalled()
  expect(driver.addLine).not.toHaveBeenCalled()
})

it('waits for claim-page navigation to stop before closing during checking', async () => {
  let release: () => void = () => undefined
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const driver = {
    readPage: vi.fn(async () => null),
    addLine: vi.fn(),
    upload: vi.fn(),
    screenshot: vi.fn(),
    scrollTop: vi.fn()
  }
  const session = new RunSession({
    review: () =>
      ({
        lines: [],
        tires: [],
        promotion: null,
        dates: null
      }) as unknown as ReviewSnapshot,
    month: () => '2026-10',
    ensurePage: async (_month, cancelled) => {
      await pending
      if (cancelled?.()) throw new Error('Claim entry was stopped.')
    },
    readPage: driver.readPage,
    driver,
    publish: vi.fn()
  })
  const starting = session.start().catch(() => undefined)
  let closed = false
  const closing = session.stopAndWait().then(() => {
    closed = true
  })
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(closed).toBe(false)
  release()
  await Promise.all([starting, closing])
  expect(driver.readPage).not.toHaveBeenCalled()
  expect(driver.addLine).not.toHaveBeenCalled()
})
