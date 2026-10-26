// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Settings } from '../../src/renderer/src/screens/Settings'
import type { SavedMatchList } from '../../src/shared/review'

afterEach(cleanup)
const matches: SavedMatchList = [
  {
    signature: 'nokian|one',
    label: 'Nokian One HT - Light Truck Tires',
    example: 'NOK ONE 245/55R19',
    decidedOn: '2026-10-26',
    inactive: false
  },
  {
    signature: 'carlisle|radialtrailhd',
    label: null,
    example: 'CAR RADIAL TRAIL HD',
    decidedOn: '2026-10-25',
    inactive: true
  }
]
it('lists saved choices, searches, and removes one', () => {
  const remove = vi.fn()
  render(
    <Settings
      theme="system"
      onThemeChange={vi.fn()}
      ready
      savedMatchesOnly
      savedMatches={matches}
      onRemoveSaved={remove}
    />
  )
  expect(screen.getByText('2 saved matches')).toBeTruthy()
  fireEvent.change(screen.getByPlaceholderText('Search saved matches'), {
    target: { value: 'nokian' }
  })
  expect(screen.getByText('nokian|one')).toBeTruthy()
  expect(screen.queryByText('carlisle|radialtrailhd')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Remove nokian|one' }))
  expect(remove).toHaveBeenCalledWith('nokian|one')
})
