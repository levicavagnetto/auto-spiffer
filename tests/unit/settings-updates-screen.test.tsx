// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Settings } from '../../src/renderer/src/screens/Settings'
import type { UpdateState } from '../../src/shared/updates'

const base: UpdateState = {
  phase: 'up-to-date',
  version: '1.0.0',
  readyVersion: null,
  checkedAt: new Date().toISOString(),
  automatic: true,
  restartQueued: false
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Settings updates and logs', () => {
  it('shows status and lets the person check and change the automatic setting', async () => {
    const onUpdate = vi.fn()
    const checkForUpdates = vi.fn(async () => base)
    const setAutomaticUpdates = vi.fn(async () => ({
      ...base,
      automatic: false
    }))
    vi.stubGlobal('api', { checkForUpdates, setAutomaticUpdates })

    render(
      <Settings
        theme="system"
        onThemeChange={vi.fn()}
        ready
        credentials={null}
        onCredentials={vi.fn()}
        update={base}
        onUpdate={onUpdate}
      />
    )

    expect(
      screen.getByText('Auto Spiffer 1.0.0 · up to date, checked just now')
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Check now' }))
    await waitFor(() => expect(checkForUpdates).toHaveBeenCalledOnce())
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Install updates automatically when no claim is being entered'
      })
    )
    await waitFor(() => expect(setAutomaticUpdates).toHaveBeenCalledWith(false))
    expect(onUpdate).toHaveBeenCalled()
  })

  it('shows a ready update and opens the logs folder', async () => {
    const restartToUpdate = vi.fn(async () => ({
      ...base,
      phase: 'ready' as const,
      readyVersion: '1.0.1'
    }))
    const openLogsFolder = vi.fn(async () => undefined)
    vi.stubGlobal('api', { restartToUpdate, openLogsFolder })

    render(
      <Settings
        theme="system"
        onThemeChange={vi.fn()}
        ready
        credentials={null}
        onCredentials={vi.fn()}
        update={{ ...base, phase: 'ready', readyVersion: '1.0.1' }}
        onUpdate={vi.fn()}
      />
    )

    expect(screen.getByText('Version 1.0.1 is ready')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Restart to update' }))
    await waitFor(() => expect(restartToUpdate).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'Open folder' }))
    await waitFor(() => expect(openLogsFolder).toHaveBeenCalledOnce())
  })
})
