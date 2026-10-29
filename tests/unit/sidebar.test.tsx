// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Sidebar } from '../../src/renderer/src/components/Sidebar'

describe('sidebar before sales are loaded', () => {
  it('shows all six places and explains the disabled steps', () => {
    render(<Sidebar current="sales" onNavigate={vi.fn()} version="1.0.0" />)
    expect(screen.getAllByRole('button')).toHaveLength(6)
    expect(
      screen.getByRole('button', { name: 'Sales' }).getAttribute('aria-current')
    ).toBe('page')
    expect(
      screen.getByRole('button', { name: 'Review' }).hasAttribute('disabled')
    ).toBe(true)
    expect(
      screen
        .getByRole('button', { name: 'Enter claims' })
        .hasAttribute('disabled')
    ).toBe(true)
    expect(screen.getByTitle("Load the month's sales first")).toBeTruthy()
    expect(screen.getByTitle('Review the sales first')).toBeTruthy()
    expect(screen.getByText('Version 1.0.0')).toBeTruthy()
  })

  it('shows a downloaded update and offers a restart', () => {
    const onRestart = vi.fn()
    render(
      <Sidebar
        current="sales"
        onNavigate={vi.fn()}
        version="1.0.0"
        update={{
          phase: 'ready',
          version: '1.0.0',
          readyVersion: '1.0.1',
          checkedAt: null,
          automatic: true,
          restartQueued: false
        }}
        onRestartToUpdate={onRestart}
      />
    )
    expect(screen.getByText('Version 1.0.1 is ready')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Restart to update' }))
    expect(onRestart).toHaveBeenCalledOnce()
  })
})
