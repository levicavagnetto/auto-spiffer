import { expect, it } from 'vitest'
import { checkPage } from '../../src/main/run/check-page'
import type { SitePage } from '../../src/main/site/driver'
import type { ReviewLine } from '../../src/shared/review'

const line = {
  id: 'one',
  saleDate: '2026-09-03',
  invoice: '900001',
  description: 'GEN RT45',
  qty: 2,
  rows: [2],
  status: 'ready',
  tire: 'General Altimax RT45 - Passenger Tires',
  suggestions: [],
  reason: '',
  signature: 'general|rt45',
  savedMatch: false,
  leftOut: false,
  readAs: { brand: 'General', sizes: ['205/55R16'], words: ['RT45'] }
} as ReviewLine
const page = {
  promotion: 'September 2026 Pro Rewards',
  window: [new Date('2026-09-01T00:00:00Z'), new Date('2026-09-30T00:00:00Z')],
  tires: [line.tire!],
  lines: []
} as SitePage

it('rejects a missing claim page before typing', () => {
  expect(checkPage(null, '2026-09', [line])).toMatchObject({
    ok: false,
    problems: [expect.stringContaining('Open the claim page')]
  })
})
it('names the wrong program and the month to open', () => {
  const result = checkPage(
    { ...page, promotion: 'October 2026 Pro Rewards' },
    '2026-09',
    [line]
  )
  expect(result.ok).toBe(false)
  expect(result.problems.join(' ')).toContain('October 2026')
  expect(result.problems.join(' ')).toContain('September 2026')
})
it('rejects unknown program dates, a sale outside them, and a missing tire', () => {
  expect(
    checkPage({ ...page, window: [null, null] }, '2026-09', [line]).problems
  ).toEqual([expect.stringContaining('dates')])
  expect(
    checkPage(page, '2026-09', [{ ...line, saleDate: '2026-08-31' }]).problems
  ).toEqual([expect.stringContaining('outside')])
  expect(
    checkPage(page, '2026-09', [{ ...line, tire: 'General RT43' }]).problems
  ).toEqual([expect.stringContaining('General RT43')])
})
it('passes with the right program, inclusive dates and all tires', () => {
  expect(
    checkPage(page, '2026-09', [
      { ...line, saleDate: '2026-09-01' },
      { ...line, saleDate: '2026-09-30' }
    ])
  ).toMatchObject({ ok: true, problems: [] })
})
