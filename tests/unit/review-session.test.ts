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
