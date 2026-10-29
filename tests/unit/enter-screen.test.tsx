// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
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
      reloadSite: vi.fn(async () => undefined),
      openRunScreenshot: vi.fn(async () => undefined)
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
  expect(screen.getByText('0 of 1 sales')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Start entering' })).toBeTruthy()
  expect(screen.getByText('1 sale · 0 invoice PDFs')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: /PDFs needing upload/ })
  ).toBeTruthy()
})
it('shows progress, current sale, and pause and stop controls', () => {
  render(
    <EnterClaims
      review={review}
      run={{
        ...base,
        phase: 'running',
        now: 'one',
        activity: [
          {
            lineId: 'one',
            kind: 'missingPdf',
            text: 'Invoice 900001: no PDF selected. Upload it by hand.'
          },
          { lineId: 'one', kind: 'added', text: 'Sale added.' }
        ]
      }}
    />
  )
  expect(screen.getByText('1 of 1 sales')).toBeTruthy()
  expect(screen.getByText('Now entering')).toBeTruthy()
  expect(screen.getByText('Invoice 900001')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy()
  expect(
    screen.getByRole('button', { name: /PDFs needing upload.*1 invoice/ })
  ).toBeTruthy()
  expect(screen.queryByText('Sale added.')).toBeNull()
  expect(screen.queryByText(/no PDF selected/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Activity/ }))
  expect(screen.getByText('Sale added.')).toBeTruthy()
  expect(screen.queryByText(/no PDF selected/)).toBeNull()
})

it('shows themed progress with the completed sale count', () => {
  render(
    <EnterClaims
      review={review}
      run={{ ...base, phase: 'running', done: 2, total: 4 }}
    />
  )
  const progress = screen.getByRole('progressbar', { name: 'Sales entered' })
  expect(progress.getAttribute('aria-valuenow')).toBe('2')
  expect(progress.getAttribute('aria-valuemax')).toBe('4')
  expect(progress.querySelector('[data-slot="progress-track"]')).toBeTruthy()
  const indicator = progress.querySelector('[data-slot="progress-indicator"]')
  expect(indicator).toBeTruthy()
  expect(indicator?.getAttribute('style')).toContain('width: 50%')
})
it('shows a consistent summary, copyable invoices, and manual submission instruction', async () => {
  const writeText = vi.fn(async () => undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText }
  })
  render(
    <EnterClaims
      review={review}
      run={{
        ...base,
        phase: 'finished',
        done: 1,
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
  expect(screen.getByText('1 of 1 sales')).toBeTruthy()
  expect(screen.getByText('1 entered · 0 already on page')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: /PDFs needing upload.*1 invoice/ })
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Copy invoice 900001' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('900001'))
  expect(
    screen.getByText(/click Next and Submit on the website yourself/)
  ).toBeTruthy()
})

it('keeps invoices without PDFs after a rerun finds sales already on the page', () => {
  render(
    <EnterClaims
      review={review}
      run={{
        ...base,
        phase: 'finished',
        done: 1,
        summary: {
          added: [],
          alreadyThere: ['one'],
          failed: [],
          uploaded: [],
          uploadFailed: [],
          missingPdfs: [],
          stopped: false
        }
      }}
    />
  )
  expect(
    screen.getByRole('button', { name: /PDFs needing upload.*1 invoice/ })
  ).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Copy invoice 900001' })
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
  expect(
    screen.getByRole('button', { name: /PDFs needing upload.*21 invoices/ })
  ).toBeTruthy()
  const details = screen.getByRole('region', { name: 'PDF invoice list' })
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

it('keeps failure details and page check available without repeating PDF warnings', () => {
  render(
    <EnterClaims
      review={review}
      run={{
        ...base,
        phase: 'finished',
        done: 1,
        check: {
          ok: true,
          program: 'October 2026 Pro Rewards',
          dates: ['2026-10-01', '2026-10-31'],
          problems: [],
          warnings: []
        },
        activity: [
          {
            lineId: 'one',
            kind: 'missingPdf',
            text: 'Invoice 900001: no PDF selected.'
          },
          {
            lineId: 'one',
            kind: 'failed',
            text: 'Invoice 900001: sale failed.'
          }
        ],
        summary: {
          added: [],
          alreadyThere: [],
          failed: [
            {
              lineId: 'one',
              invoice: '900001',
              reason: 'Sale failed.',
              screenshot: 'picture.png'
            }
          ],
          uploaded: [],
          uploadFailed: [{ invoice: '900001', reason: 'Upload failed.' }],
          missingPdfs: ['900001'],
          stopped: false
        }
      }}
    />
  )
  expect(screen.getByText('Page check passed')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: /PDFs needing upload.*1 invoice/ })
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Activity/ }))
  expect(screen.getByText('Invoice 900001: Sale failed.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Open page picture' })).toBeTruthy()
  expect(screen.getByText(/PDF upload failed/)).toBeTruthy()
  expect(screen.queryByText('Invoice 900001: no PDF selected.')).toBeNull()
})

it('collapses the PDF details when another run starts', () => {
  const finished: RunState = {
    ...base,
    phase: 'finished',
    done: 1,
    summary: {
      added: ['one'],
      alreadyThere: [],
      failed: [],
      uploaded: [],
      uploadFailed: [],
      missingPdfs: ['900001'],
      stopped: false
    }
  }
  const view = render(<EnterClaims review={review} run={finished} />)
  expect(
    screen
      .getByRole('button', { name: /PDFs needing upload/ })
      .getAttribute('aria-expanded')
  ).toBe('true')
  view.rerender(
    <EnterClaims
      review={review}
      run={{ ...base, phase: 'running', now: 'one' }}
    />
  )
  expect(
    screen
      .getByRole('button', { name: /PDFs needing upload/ })
      .getAttribute('aria-expanded')
  ).toBe('false')
})
