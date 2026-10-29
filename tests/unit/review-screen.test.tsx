// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Review } from '../../src/renderer/src/screens/Review'
import type { ReviewSnapshot } from '../../src/shared/review'

const snapshot = {
  promotion: 'September',
  dates: ['2026-09-01', '2026-09-30'],
  tires: [
    {
      label: 'Nokian One HT - Light Truck Tires',
      brand: 'Nokian',
      model: 'One HT',
      category: 'Light Truck',
      kind: 'tire'
    }
  ],
  lines: [
    {
      id: 'one',
      saleDate: '2026-09-03',
      invoice: '900001',
      description: 'NOK ONE 245/55R19',
      qty: 4,
      rows: [2],
      status: 'needs-decision',
      guess: 'Nokian One HT - Light Truck Tires',
      suggestions: [
        {
          label: 'Nokian One HT - Light Truck Tires',
          score: 67,
          reason: 'Missing HT'
        }
      ],
      reason: 'The list tire has HT which the report line does not.',
      signature: 'nokian|one',
      savedMatch: false,
      leftOut: false,
      readAs: { brand: 'Nokian', sizes: ['245/55R19'], words: ['ONE'] }
    },
    {
      id: 'two',
      saleDate: '2026-09-04',
      invoice: '900002',
      description: 'FAL AKLIMATE 205/60R16',
      qty: 2,
      rows: [3],
      status: 'ready',
      tire: 'Falken Aklimate - Passenger Tires',
      suggestions: [],
      reason: 'Exact tire name.',
      signature: 'falken|aklimate',
      savedMatch: false,
      leftOut: false,
      readAs: { brand: 'Falken', sizes: ['205/60R16'], words: ['AKLIMATE'] }
    }
  ]
} as ReviewSnapshot
afterEach(() => {
  cleanup()
  document.querySelector('header')?.remove()
})

function headerTarget(): HTMLElement {
  const header = document.createElement('header')
  document.body.append(header)
  return header
}

it('filters by status, searches invoices, and blocks entry until decisions are settled', () => {
  const header = headerTarget()
  render(
    <Review
      headerActions={header}
      snapshot={snapshot}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  expect(screen.getByText('Decide 1 tire to continue')).toBeTruthy()
  expect(
    within(header).getByRole('button', { name: 'Enter 1 sale' })
  ).toBeTruthy()
  expect(
    screen
      .getByRole('button', { name: 'Enter 1 sale' })
      .hasAttribute('disabled')
  ).toBe(true)
  fireEvent.click(screen.getByRole('tab', { name: 'Ready 1' }))
  expect(screen.getByText('900002')).toBeTruthy()
  expect(screen.queryByText('900001')).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: 'All 2' }))
  fireEvent.change(screen.getByPlaceholderText('Search invoice or tire'), {
    target: { value: '900001' }
  })
  expect(screen.getByText('900001')).toBeTruthy()
  expect(screen.queryByText('900002')).toBeNull()
})

it('opens a tire decision sheet with suggestions and a search', () => {
  render(
    <Review
      snapshot={snapshot}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /Review 900001/ }))
  expect(
    screen.getByRole('dialog', { name: 'Which tire is this?' })
  ).toBeTruthy()
  expect(screen.getAllByText('NOK ONE 245/55R19').length).toBeGreaterThan(0)
  expect(screen.getByText('67%')).toBeTruthy()
  expect(
    screen.getByRole('checkbox', { name: 'Remember this choice' })
  ).toBeTruthy()
})

it('keeps Enter in the header as ready lines change', () => {
  const header = headerTarget()
  const onEnter = vi.fn()
  const props = {
    run: null,
    onSnapshot: vi.fn(),
    onEnter,
    headerActions: header
  }
  const { rerender } = render(<Review {...props} snapshot={snapshot} />)
  const decided = {
    ...snapshot,
    lines: snapshot.lines.map((line) =>
      line.id === 'one' ? { ...line, status: 'not-eligible' as const } : line
    )
  }
  rerender(<Review {...props} snapshot={decided} />)
  const readyButton = within(header).getByRole('button', {
    name: 'Enter 1 sale'
  })
  expect(readyButton.hasAttribute('disabled')).toBe(false)
  fireEvent.click(readyButton)
  expect(onEnter).toHaveBeenCalledOnce()
  rerender(
    <Review
      {...props}
      snapshot={{
        ...decided,
        lines: decided.lines.map((line) => ({ ...line, leftOut: true }))
      }}
    />
  )
  expect(
    within(header)
      .getByRole('button', { name: 'Enter 0 sales' })
      .hasAttribute('disabled')
  ).toBe(true)
})
