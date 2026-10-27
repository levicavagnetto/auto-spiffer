// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EnterClaims } from '../../src/renderer/src/screens/EnterClaims'
import type { ReviewSnapshot } from '../../src/shared/review'
import type { RunState } from '../../src/shared/run'

const review = {
  promotion: 'October 2026 Pro Rewards',
  dates: ['2026-10-01', '2026-10-31'],
  tires: [],
  lines: [
    {
      id: 'one',
      saleDate: '2026-10-18',
      invoice: '900001',
      description: 'NOK REMEDY WRG5',
      qty: 2,
      rows: [2],
      status: 'ready',
      tire: 'Nokian Remedy WRG5 - Passenger Tires',
      suggestions: [],
      reason: '',
      signature: 'nokian|remedy',
      savedMatch: false,
      leftOut: false,
      readAs: { brand: 'Nokian', sizes: [], words: [] }
    }
  ]
} as ReviewSnapshot
const base: RunState = {
  phase: 'idle',
  check: null,
  summary: null,
  done: 0,
  total: 1,
  now: null,
  activity: []
}

beforeEach(() => {
  class Observer {
    observe(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', Observer)
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      on: vi.fn(() => () => undefined),
      getRunState: vi.fn(async () => base),
      getRunLimit: vi.fn(async () => null),
      getSiteStatus: vi.fn(async () => ({
        address: 'https://example.test',
        state: 'ready'
      })),
      setSiteBounds: vi.fn(async () => undefined),
      reloadSite: vi.fn(async () => undefined)
    }
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('shows the plan before starting', () => {
  render(<EnterClaims review={review} run={base} />)
  expect(screen.getByText('Ready to enter')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Start entering' })).toBeTruthy()
  expect(screen.getByText('1 sale · 0 invoice PDFs')).toBeTruthy()
})
it('shows progress, current sale, and pause and stop controls', () => {
  render(
    <EnterClaims
      review={review}
      run={{
        ...base,
        phase: 'running',
        now: 'one',
        activity: [{ lineId: 'one', kind: 'added', text: 'Sale added.' }]
      }}
    />
  )
  expect(screen.getByText('1 of 1 sales')).toBeTruthy()
  expect(screen.getByText(/Now: 900001/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy()
  expect(screen.getByText('Sale added.')).toBeTruthy()
})
it('shows the summary and manual submission instruction', () => {
  render(
    <EnterClaims
      review={review}
      run={{
        ...base,
        phase: 'finished',
        summary: {
          added: ['one'],
          alreadyThere: [],
          failed: [],
          uploaded: [],
          uploadFailed: [],
          missingPdfs: ['900001'],
          stopped: false
        }
      }}
    />
  )
  expect(screen.getByText('Finished entering')).toBeTruthy()
  expect(screen.getByText('PDFs to upload yourself (1)')).toBeTruthy()
  expect(screen.getByText('Invoice 900001')).toBeTruthy()
  expect(
    screen.getByText(/click Next and Submit on the website yourself/)
  ).toBeTruthy()
})

it('groups a long missing-PDF list in a scrollable summary with visible actions', () => {
  const missingPdfs = Array.from({ length: 20 }, (_, index) =>
    String(900100 + index)
  )
  render(
    <EnterClaims
      review={review}
      run={{
        ...base,
        phase: 'finished',
        summary: {
          added: ['one'],
          alreadyThere: [],
          failed: [],
          uploaded: [],
          uploadFailed: [],
          missingPdfs,
          stopped: false
        }
      }}
    />
  )
  expect(screen.getByText('PDFs to upload yourself (20)')).toBeTruthy()
  const details = screen.getByRole('region', { name: 'Run details' })
  expect(details.className).toContain('overflow-y-auto')
  expect(details.textContent).toContain('900100')
  expect(details.textContent).toContain('900119')
  expect(
    screen.getByRole('button', { name: 'Check page and run again' })
  ).toBeTruthy()
  expect(
    screen.getByText(/click Next and Submit on the website yourself/)
  ).toBeTruthy()
})
