import { describe, expect, it, vi } from 'vitest'
import { dispatchCall } from '../../src/main/ipc-dispatch'
import type { CallHandlers } from '../../src/shared/ipc'

const handlers: CallHandlers = {
  getSettings: () => ({
    theme: 'system',
    windowBounds: { width: 1280, height: 800 }
  }),
  setTheme: () => ({
    theme: 'dark',
    windowBounds: { width: 1280, height: 800 }
  }),
  getSystemTheme: () => false,
  getAppVersion: () => '1.0.0',
  setSiteBounds: () => undefined,
  getSiteStatus: () => ({ address: '', state: 'notOpened' }),
  reloadSite: () => undefined,
  isClaimPage: () => false,
  readSitePage: () => null,
  getLiveCheckAvailable: () => false,
  testAddLine: () => ({
    kind: 'rejected',
    timing: { fillMs: 0, addMs: 0, method: 'none' }
  }),
  testUpload: () => undefined
}

describe('IPC dispatch', () => {
  it('accepts only a named call and validates its result', async () => {
    const log = vi.fn()
    await expect(
      dispatchCall({ name: 'getAppVersion', input: undefined }, handlers, log)
    ).resolves.toBe('1.0.0')
    expect(log).not.toHaveBeenCalled()
  })

  it('rejects and logs an unknown call without running a handler', async () => {
    const log = vi.fn()
    const run = vi.fn(handlers.getAppVersion)
    await expect(
      dispatchCall(
        { name: 'eraseFiles', input: undefined },
        { ...handlers, getAppVersion: run },
        log
      )
    ).rejects.toThrow('Unknown app call')
    expect(log).toHaveBeenCalledOnce()
    expect(run).not.toHaveBeenCalled()
  })

  it('rejects and logs invalid input without running a handler', async () => {
    const log = vi.fn()
    const run = vi.fn(handlers.setTheme)
    await expect(
      dispatchCall(
        { name: 'setTheme', input: 'purple' },
        { ...handlers, setTheme: run },
        log
      )
    ).rejects.toThrow('Invalid app call input')
    expect(log).toHaveBeenCalledOnce()
    expect(run).not.toHaveBeenCalled()
  })
})
