// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sales } from '../../src/renderer/src/screens/Sales'
import type { SalesSnapshot } from '../../src/shared/sales'

const snapshot: SalesSnapshot = {
  state: {
    file: 'sales.xlsx',
    sales: [],
    unreadable: [],
    month: '2026-10',
    pdfs: []
  },
  links: {
    usedByInvoice: {},
    missingInvoices: [],
    extraPdfs: [],
    unlinkedPdfs: [],
    unreadablePdfs: [],
    duplicateInvoices: [],
    identicalCopies: [],
    loadedCount: 0,
    linkedCount: 0
  },
  warnings: []
}

afterEach(() => cleanup())

describe('Match tires button', () => {
  it('shows a spinner and stays disabled while matching', async () => {
    let finish = (): void => undefined
    const onMatch = vi.fn(
      () => new Promise<void>((done) => (finish = () => done()))
    )
    const header = document.createElement('div')
    document.body.append(header)
    render(
      <Sales
        snapshot={snapshot}
        headerActions={header}
        onSnapshot={vi.fn()}
        onMatch={onMatch}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Match tires' }))
    const busy = await screen.findByRole('button', {
      name: 'Matching tires…'
    })
    expect(busy.hasAttribute('disabled')).toBe(true)
    expect(busy.getAttribute('aria-busy')).toBe('true')
    expect(busy.querySelector('.animate-spin')).not.toBeNull()
    expect(screen.getByRole('status').textContent).toContain('matching tires')

    await act(async () => finish())
    expect(
      screen
        .getByRole('button', { name: 'Match tires' })
        .hasAttribute('disabled')
    ).toBe(false)
    header.remove()
  })
})
