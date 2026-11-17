// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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

it('closes the tire decision sheet with Esc and returns focus to the row', async () => {
  render(
    <Review
      snapshot={snapshot}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  const opener = screen.getByRole('button', { name: /Review 900001/ })
  opener.focus()
  fireEvent.click(opener)
  const dialog = await screen.findByRole('dialog', {
    name: 'Which tire is this?'
  })
  await waitFor(() =>
    expect(dialog.contains(document.activeElement)).toBe(true)
  )
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Which tire is this?' })
    ).toBeNull()
  )
  await waitFor(() => expect(document.activeElement).toBe(opener))
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

it('shows possible wheels in their own filter with a note', () => {
  const header = headerTarget()
  const withWheels: ReviewSnapshot = {
    ...snapshot,
    lines: [
      snapshot.lines[1]!,
      {
        ...snapshot.lines[1]!,
        id: 'wheel',
        invoice: '900003',
        description: 'STYLE A 20X10 -12 5X5.00 BLACK',
        status: 'possible-wheel',
        tire: undefined,
        pdf: 'wheel.pdf'
      },
      {
        ...snapshot.lines[1]!,
        id: 'tube',
        invoice: '900004',
        description: 'TR13 TUBE',
        status: 'not-a-tire',
        tire: undefined
      }
    ]
  }
  render(
    <Review
      headerActions={header}
      snapshot={withWheels}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  expect(
    within(header).getByRole('button', { name: 'Enter 1 sale' })
  ).toBeTruthy()
  expect(screen.getByRole('tab', { name: 'All 3' })).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: 'Wheels 1' }))
  expect(screen.getByText('900003')).toBeTruthy()
  expect(screen.queryByText('900002')).toBeNull()
  expect(screen.queryByText('900004')).toBeNull()
  expect(
    screen.getByText(/choose ATD Custom Wheels or ATD Steel Wheels/)
  ).toBeTruthy()
  expect(screen.getByText('✓')).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: 'Not a tire 1' }))
  expect(screen.getByText('900004')).toBeTruthy()
  expect(screen.queryByText('900003')).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: 'All 3' }))
  expect(screen.getByText('900003')).toBeTruthy()
  fireEvent.change(screen.getByPlaceholderText('Search invoice or tire'), {
    target: { value: '900003' }
  })
  expect(screen.getByText('900003')).toBeTruthy()
  expect(screen.queryByText('900002')).toBeNull()
})

const wheelSnapshot: ReviewSnapshot = {
  ...snapshot,
  tires: [
    ...snapshot.tires,
    {
      label: 'ATD Custom Wheels',
      brand: 'ATD',
      model: 'Custom Wheels',
      category: null,
      kind: 'wheel'
    },
    {
      label: 'ATD Steel Wheels',
      brand: 'ATD',
      model: 'Steel Wheels',
      category: null,
      kind: 'wheel'
    }
  ],
  lines: [
    snapshot.lines[0]!,
    {
      ...snapshot.lines[1]!,
      id: 'wheel',
      invoice: '900003',
      description: 'STYLE A 20X10 -12 5X5.00 BLACK',
      status: 'possible-wheel',
      tire: undefined,
      signature: 'wheel|style a black'
    }
  ]
}

it('opens the wheel form for a possible wheel and approves it', async () => {
  const decideLine = vi.fn(async () => wheelSnapshot)
  Object.assign(window, { api: { decideLine } })
  render(
    <Review
      snapshot={wheelSnapshot}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  fireEvent.click(screen.getByText('900003'))
  const dialog = screen.getByRole('dialog', { name: 'Which wheel is this?' })
  expect(
    within(dialog).queryByLabelText('Search all claim page tires')
  ).toBeNull()
  fireEvent.click(
    within(dialog).getByRole('radio', { name: 'ATD Steel Wheels' })
  )
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Use ATD Steel Wheels' })
  )
  await waitFor(() =>
    expect(decideLine).toHaveBeenCalledWith({
      signature: 'wheel|style a black',
      label: 'ATD Steel Wheels',
      remember: true
    })
  )
})

it('switches a tire line to the wheel form', () => {
  render(
    <Review
      snapshot={wheelSnapshot}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  fireEvent.click(screen.getByText('900001'))
  fireEvent.click(screen.getByRole('button', { name: 'This is a wheel' }))
  expect(
    screen.getByRole('dialog', { name: 'Which wheel is this?' })
  ).toBeTruthy()
  expect(screen.getByRole('button', { name: 'This is a tire' })).toBeTruthy()
})

it('says when the claim page has no wheel products', () => {
  render(
    <Review
      snapshot={{ ...wheelSnapshot, tires: snapshot.tires }}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  fireEvent.click(screen.getByText('900003'))
  expect(screen.getByText(/has no wheel products/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Use / })).toBeNull()
})

it('has no claim page tire or this month column and shows the tire under the report', () => {
  render(
    <Review
      snapshot={snapshot}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  expect(
    screen.queryByRole('columnheader', { name: 'Claim page tire' })
  ).toBeNull()
  expect(screen.queryByRole('columnheader', { name: 'This month' })).toBeNull()
  expect(screen.getByText('Falken Aklimate - Passenger Tires')).toBeTruthy()
  expect(screen.getByText('Nokian One HT - Light Truck Tires ?')).toBeTruthy()
})

it('includes lines with checkboxes and select all without opening the panel', async () => {
  const setLinesLeftOut = vi.fn(async () => snapshot)
  Object.assign(window, { api: { setLinesLeftOut } })
  render(
    <Review
      snapshot={snapshot}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  fireEvent.click(screen.getByRole('checkbox', { name: /Include 900001/ }))
  await waitFor(() =>
    expect(setLinesLeftOut).toHaveBeenCalledWith({
      ids: ['one'],
      leftOut: true
    })
  )
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include all' }))
  await waitFor(() =>
    expect(setLinesLeftOut).toHaveBeenLastCalledWith({
      ids: ['one', 'two'],
      leftOut: true
    })
  )
})

it('shows a Tire or Wheel type pill for each line', () => {
  render(
    <Review
      snapshot={wheelSnapshot}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  expect(screen.getByRole('columnheader', { name: 'Type' })).toBeTruthy()
  const tireRow = screen.getByText('900001').closest('tr')!
  const wheelRow = screen.getByText('900003').closest('tr')!
  expect(within(tireRow).getByText('Tire')).toBeTruthy()
  expect(within(wheelRow).getByText('Wheel')).toBeTruthy()
})

it('sorts by a column when its header is clicked', () => {
  render(
    <Review
      snapshot={snapshot}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  const invoices = (): string[] =>
    screen.getAllByText(/^90000\d$/).map((cell) => cell.textContent ?? '')
  expect(invoices()).toEqual(['900001', '900002'])
  fireEvent.click(screen.getByRole('button', { name: 'Qty' }))
  expect(invoices()).toEqual(['900002', '900001'])
  expect(
    screen.getByRole('columnheader', { name: 'Qty' }).getAttribute('aria-sort')
  ).toBe('ascending')
  fireEvent.click(screen.getByRole('button', { name: 'Qty' }))
  expect(invoices()).toEqual(['900001', '900002'])
  fireEvent.click(screen.getByRole('button', { name: 'Qty' }))
  expect(
    screen.getByRole('columnheader', { name: 'Qty' }).getAttribute('aria-sort')
  ).toBe('none')
})

it('sorts by every column without crashing', () => {
  render(
    <Review
      snapshot={wheelSnapshot}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  for (const name of [
    'Status',
    'Type',
    'Date',
    'Invoice',
    'On the report',
    'Qty',
    'PDF'
  ]) {
    fireEvent.click(screen.getByRole('button', { name }))
    fireEvent.click(screen.getByRole('button', { name }))
    expect(screen.getByText('900003')).toBeTruthy()
  }
})

it('focuses the search box when / is pressed outside a text box', () => {
  render(
    <Review
      snapshot={snapshot}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  const search = screen.getByRole('textbox', { name: 'Search invoice or tire' })
  fireEvent.keyDown(document.body, { key: '/' })
  expect(document.activeElement).toBe(search)
  fireEvent.change(search, { target: { value: '900' } })
  search.blur()
  fireEvent.click(screen.getByText('900001'))
  const tireSearch = screen.getByLabelText('Search all claim page tires')
  tireSearch.focus()
  fireEvent.keyDown(tireSearch, { key: '/' })
  expect(document.activeElement).toBe(tireSearch)
})

it('filters to tires only with the Tires tab', () => {
  render(
    <Review
      snapshot={wheelSnapshot}
      run={null}
      onSnapshot={vi.fn()}
      onEnter={vi.fn()}
    />
  )
  const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent)
  expect(tabs.indexOf('Tires 1')).toBe(tabs.indexOf('Wheels 1') - 1)
  fireEvent.click(screen.getByRole('tab', { name: 'Tires 1' }))
  expect(screen.getByText('900001')).toBeTruthy()
  expect(screen.queryByText('900003')).toBeNull()
})
