import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { openSavedMatches } from '../../src/main/matching/saved-matches'

const folders: string[] = []
function folder(): string {
  const path = mkdtempSync(join(tmpdir(), 'auto-spiffer-matches-'))
  folders.push(path)
  return path
}
afterEach(() => {
  for (const path of folders.splice(0)) {
    const safe = realpathSync(path)
    if (!safe.startsWith(realpathSync(tmpdir()) + sep))
      throw new Error('Unsafe cleanup')
    rmSync(safe, { recursive: true })
  }
})

it('saves, replaces and removes a choice across sessions', () => {
  const path = folder()
  const first = openSavedMatches(path, vi.fn(), vi.fn())
  first.set(
    'nokian|one',
    'Nokian One HT - Light Truck Tires',
    'NOK ONE 245/55R19'
  )
  expect(
    openSavedMatches(path, vi.fn(), vi.fn()).read()['nokian|one']?.label
  ).toBe('Nokian One HT - Light Truck Tires')
  first.set('nokian|one', null, 'NOK ONE 215/70R16')
  expect(
    openSavedMatches(path, vi.fn(), vi.fn()).read()['nokian|one']?.label
  ).toBeNull()
  first.remove('nokian|one')
  expect(openSavedMatches(path, vi.fn(), vi.fn()).read()).toEqual({})
})

it('marks a saved tire inactive only while absent from the current list', () => {
  const matches = openSavedMatches(folder(), vi.fn(), vi.fn())
  matches.set('nokian|one', 'Nokian One HT - Light Truck Tires', 'NOK ONE')
  expect(matches.list(['Other Tire']).at(0)?.inactive).toBe(true)
  expect(matches.list(null).at(0)?.inactive).toBe(false)
  expect(
    matches.list(['Nokian One HT - Light Truck Tires']).at(0)?.inactive
  ).toBe(false)
})

it('moves a damaged file aside and tells the person once', () => {
  const path = folder()
  writeFileSync(join(path, 'saved-matches.json'), '{broken')
  const notify = vi.fn()
  const store = openSavedMatches(path, vi.fn(), notify)
  expect(store.read()).toEqual({})
  expect(notify).toHaveBeenCalledOnce()
  expect(
    readdirSync(path).some((name) => name.startsWith('saved-matches.damaged-'))
  ).toBe(true)
  if (existsSync(join(path, 'saved-matches.json'))) {
    expect(
      readFileSync(join(path, 'saved-matches.json'), 'utf8')
    ).not.toContain('{broken')
  }
  expect(
    readFileSync(
      join(
        path,
        readdirSync(path).find((name) =>
          name.startsWith('saved-matches.damaged-')
        )!
      ),
      'utf8'
    )
  ).toBe('{broken')
})
