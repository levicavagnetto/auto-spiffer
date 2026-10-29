import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openSettings } from '../../src/main/settings'

const folders: string[] = []

function tempFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'auto-spiffer-settings-'))
  folders.push(folder)
  return folder
}

afterEach(() => {
  for (const folder of folders.splice(0)) {
    const resolved = realpathSync(folder)
    if (!resolved.startsWith(realpathSync(tmpdir()) + sep))
      throw new Error('Unsafe test cleanup path')
    rmSync(resolved, { recursive: true, force: true })
  }
})

describe('settings store', () => {
  it('uses defaults when no file exists', () => {
    const store = openSettings(tempFolder(), vi.fn())
    expect(store.read()).toEqual({
      theme: 'system',
      automaticUpdates: true,
      windowBounds: { width: 1280, height: 800 }
    })
  })

  it('keeps theme and window size across a new store instance', () => {
    const folder = tempFolder()
    const store = openSettings(folder, vi.fn())
    store.setTheme('dark')
    store.setWindowBounds({ width: 1360, height: 900 })
    expect(openSettings(folder, vi.fn()).read()).toEqual({
      theme: 'dark',
      automaticUpdates: true,
      windowBounds: { width: 1360, height: 900 }
    })
  })

  it('restores defaults and logs when the file is damaged', () => {
    const folder = tempFolder()
    const store = openSettings(folder, vi.fn())
    store.setTheme('dark')
    writeFileSync(join(folder, 'settings.json'), '{broken json')
    const log = vi.fn()
    expect(openSettings(folder, log).read()).toEqual({
      theme: 'system',
      automaticUpdates: true,
      windowBounds: { width: 1280, height: 800 }
    })
    expect(log).toHaveBeenCalledOnce()
    expect(readFileSync(join(folder, 'settings.json'), 'utf8')).not.toContain(
      'broken json'
    )
  })

  it('keeps the automatic update preference after restart', () => {
    const folder = tempFolder()
    openSettings(folder, vi.fn()).setAutomaticUpdates(false)
    expect(openSettings(folder, vi.fn()).read().automaticUpdates).toBe(false)
  })
})
