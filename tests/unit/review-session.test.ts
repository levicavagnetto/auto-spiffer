import { expect, it, vi } from 'vitest'
import { ReviewSession } from '../../src/main/matching/session'
import type { SalesSnapshot } from '../../src/shared/sales'
import type { SitePage } from '../../src/main/site/driver'

const snapshot = {
  state: {
    month: '2026-09',
    sales: [
      {
        row: 2,
        saleDate: '2026-09-03',
        invoice: '900001',
        description: 'NOK ONE 245/55R19',
        qty: 1,
        notATire: null
      },
      {
        row: 3,
        saleDate: '2026-09-04',
        invoice: '900002',
        description: 'NOK ONE 215/70R16',
        qty: 2,
        notATire: null
      }
    ]
  },
  links: { usedByInvoice: {} }
} as SalesSnapshot
const page = {
  promotion: 'September',
  window: [new Date('2026-09-01T00:00:00Z'), new Date('2026-09-30T00:00:00Z')],
  tires: ['Nokian One HT - Light Truck Tires'],
  lines: []
} as SitePage

it('requires the live claim page before matching', async () => {
  const session = new ReviewSession(
    () => snapshot,
    async () => null,
    { read: () => ({}), set: vi.fn(), remove: vi.fn(), list: () => [] }
  )
  await expect(session.match()).rejects.toThrow(
    'Open the claim page for September 2026'
  )
})

it('settles every line with the same wording and remembers by default', async () => {
  const set = vi.fn()
  const session = new ReviewSession(
    () => snapshot,
    async () => page,
    { read: () => ({}), set, remove: vi.fn(), list: () => [] }
  )
  expect((await session.match()).lines.map((line) => line.status)).toEqual([
    'needs-decision',
    'needs-decision'
  ])
  expect(
    session
      .decide({
        signature: 'nokian|one',
        label: page.tires[0]!,
        remember: true
      })
      .lines.map((line) => line.status)
  ).toEqual(['ready', 'ready'])
  expect(set).toHaveBeenCalledWith(
    'nokian|one',
    page.tires[0],
    'NOK ONE 245/55R19'
  )
})

it('keeps a choice with Remember off only in this session', async () => {
  const set = vi.fn()
  const session = new ReviewSession(
    () => snapshot,
    async () => page,
    { read: () => ({}), set, remove: vi.fn(), list: () => [] }
  )
  await session.match()
  expect(
    session.decide({ signature: 'nokian|one', label: null, remember: false })
      .lines[0]?.status
  ).toBe('not-eligible')
  expect(set).not.toHaveBeenCalled()
  session.reset()
  expect(session.snapshot()).toBeNull()
})

it('does not save a tire choice for a non-tire row', async () => {
  const set = vi.fn()
  const tube = {
    ...snapshot,
    state: {
      ...snapshot.state,
      sales: [
        {
          row: 2,
          saleDate: '2026-09-03',
          invoice: '900003',
          description: '18X8.50/9.50-8 FST TR13 TUBE',
          qty: 1,
          notATire: 'tube' as const
        }
      ]
    }
  } as SalesSnapshot
  const session = new ReviewSession(
    () => tube,
    async () => page,
    { read: () => ({}), set, remove: vi.fn(), list: () => [] }
  )
  await session.match()
  expect(() =>
    session.decide({
      signature: 'row|2',
      label: page.tires[0]!,
      remember: true
    })
  ).toThrow('not a tire')
  expect(set).not.toHaveBeenCalled()
})

const wheelSales = {
  ...snapshot,
  state: {
    ...snapshot.state,
    sales: [
      {
        row: 2,
        saleDate: '2026-09-03',
        invoice: '900020',
        description: 'XW OFFROAD XW-123 20X9 8X165.1 +12 BLACK',
        qty: 4,
        notATire: 'wheel' as const
      }
    ]
  }
} as SalesSnapshot
const wheelPage = {
  ...page,
  tires: [...page.tires, 'ATD Custom Wheels', 'ATD Steel Wheels']
} as SitePage
const wheelSignature = 'wheel|xw offroad xw-123 black'

it('approves a possible wheel as a wheel product and remembers it', async () => {
  const set = vi.fn()
  const session = new ReviewSession(
    () => wheelSales,
    async () => wheelPage,
    { read: () => ({}), set, remove: vi.fn(), list: () => [] }
  )
  const before = await session.match()
  expect(before.lines[0]).toMatchObject({
    status: 'possible-wheel',
    signature: wheelSignature
  })
  const after = session.decide({
    signature: wheelSignature,
    label: 'ATD Steel Wheels',
    remember: true
  })
  expect(after.lines[0]).toMatchObject({
    status: 'ready',
    tire: 'ATD Steel Wheels',
    qty: 4
  })
  expect(set).toHaveBeenCalledWith(
    wheelSignature,
    'ATD Steel Wheels',
    'XW OFFROAD XW-123 20X9 8X165.1 +12 BLACK'
  )
})

it('uses a saved wheel next month and holds it back when the product is gone', async () => {
  const saved = {
    [wheelSignature]: {
      label: 'ATD Custom Wheels',
      example: 'x',
      decidedOn: '2026-09-01'
    }
  }
  const nextMonth = {
    ...wheelSales,
    state: {
      ...wheelSales.state,
      sales: [
        {
          ...wheelSales.state.sales[0]!,
          description: 'XW OFFROAD XW-123 18X9 6X139.7 +0 BLACK'
        }
      ]
    }
  } as SalesSnapshot
  const access = {
    read: () => saved,
    set: vi.fn(),
    remove: vi.fn(),
    list: () => []
  }
  const withWheels = new ReviewSession(
    () => nextMonth,
    async () => wheelPage,
    access
  )
  expect((await withWheels.match()).lines[0]).toMatchObject({
    status: 'ready',
    tire: 'ATD Custom Wheels',
    savedMatch: true
  })
  const noWheels = new ReviewSession(
    () => nextMonth,
    async () => page,
    access
  )
  expect((await noWheels.match()).lines[0]).toMatchObject({
    status: 'possible-wheel',
    tire: undefined,
    reason:
      "This month's claim page has no wheel products, so wheels can't be entered."
  })
})

it('lets a tire line be marked as a wheel and a wheel be not eligible', async () => {
  const session = new ReviewSession(
    () => snapshot,
    async () => wheelPage,
    { read: () => ({}), set: vi.fn(), remove: vi.fn(), list: () => [] }
  )
  await session.match()
  const lines = session.decide({
    signature: 'nokian|one',
    label: 'ATD Custom Wheels',
    remember: false
  }).lines
  expect(lines.every((line) => line.tire === 'ATD Custom Wheels')).toBe(true)
  const wheel = new ReviewSession(
    () => wheelSales,
    async () => wheelPage,
    { read: () => ({}), set: vi.fn(), remove: vi.fn(), list: () => [] }
  )
  await wheel.match()
  expect(
    wheel.decide({ signature: wheelSignature, label: null, remember: false })
      .lines[0]?.status
  ).toBe('not-eligible')
})

it('includes and leaves out several lines at once', async () => {
  const session = new ReviewSession(
    () => snapshot,
    async () => page,
    { read: () => ({}), set: vi.fn(), remove: vi.fn(), list: () => [] }
  )
  const ids = (await session.match()).lines.map((line) => line.id)
  expect(
    session.setLeftOut({ ids, leftOut: true }).lines.every((l) => l.leftOut)
  ).toBe(true)
  expect(
    session.setLeftOut({ ids, leftOut: false }).lines.some((l) => l.leftOut)
  ).toBe(false)
  expect(() => session.setLeftOut({ ids: ['gone'], leftOut: true })).toThrow(
    'no longer in the review'
  )
})
