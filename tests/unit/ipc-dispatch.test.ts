import { describe, expect, it, vi } from 'vitest'
import { dispatchCall } from '../../src/main/ipc-dispatch'
import type { CallHandlers } from '../../src/shared/ipc'

const handlers: CallHandlers = {
  getCredentials: () => ({ email: '', hasPassword: false, staySignedIn: true }),
  saveCredentials: () => ({
    email: 'shop@example.com',
    hasPassword: true,
    staySignedIn: true
  }),
  setStaySignedIn: () => ({
    email: '',
    hasPassword: false,
    staySignedIn: false
  }),
  forgetCredentials: () => ({
    email: '',
    hasPassword: false,
    staySignedIn: true
  }),
  getSettings: () => ({
    theme: 'system',
    automaticUpdates: true,
    windowBounds: { width: 1280, height: 800 }
  }),
  setTheme: () => ({
    theme: 'dark',
    automaticUpdates: true,
    windowBounds: { width: 1280, height: 800 }
  }),
  getSystemTheme: () => false,
  getAppVersion: () => '1.0.0',
  getUpdateState: () => ({
    phase: 'idle',
    version: '1.0.0',
    readyVersion: null,
    checkedAt: null,
    automatic: true,
    restartQueued: false
  }),
  checkForUpdates: () => ({
    phase: 'idle',
    version: '1.0.0',
    readyVersion: null,
    checkedAt: null,
    automatic: true,
    restartQueued: false
  }),
  setAutomaticUpdates: () => ({
    phase: 'idle',
    version: '1.0.0',
    readyVersion: null,
    checkedAt: null,
    automatic: false,
    restartQueued: false
  }),
  restartToUpdate: () => ({
    phase: 'idle',
    version: '1.0.0',
    readyVersion: null,
    checkedAt: null,
    automatic: true,
    restartQueued: false
  }),
  openLogsFolder: () => undefined,
  setSiteBounds: () => undefined,
  getSiteStatus: () => ({ address: '', state: 'notOpened' }),
  getSiteLocation: () => 'other',
  retrySignIn: () => undefined,
  reloadSite: () => undefined,
  isClaimPage: () => false,
  readSitePage: () => null,
  getLiveCheckAvailable: () => false,
  testAddLine: () => ({
    kind: 'rejected',
    timing: { fillMs: 0, addMs: 0, method: 'none' }
  }),
  testUpload: () => undefined,
  getSalesSnapshot: () => null,
  pickSalesExport: () => null,
  loadSalesExport: () => {
    throw new Error('No fixture')
  },
  pickInvoicePdfs: () => null,
  pickInvoiceFolder: () => null,
  addInvoicePaths: () => {
    throw new Error('No fixture')
  },
  removeInvoicePdf: () => {
    throw new Error('No fixture')
  },
  getReviewSnapshot: () => null,
  matchTires: () => {
    throw new Error('No fixture')
  },
  decideTire: () => {
    throw new Error('No fixture')
  },
  setLineLeftOut: () => {
    throw new Error('No fixture')
  },
  listSavedMatches: () => [],
  removeSavedMatch: () => undefined,
  getRunLimit: () => null,
  getRunState: () => ({
    phase: 'idle',
    check: null,
    summary: null,
    done: 0,
    total: 0,
    now: null,
    activity: []
  }),
  checkRunPage: () => ({
    phase: 'idle',
    check: null,
    summary: null,
    done: 0,
    total: 0,
    now: null,
    activity: []
  }),
  startRun: () => ({
    phase: 'idle',
    check: null,
    summary: null,
    done: 0,
    total: 0,
    now: null,
    activity: []
  }),
  pauseRun: () => ({
    phase: 'paused',
    check: null,
    summary: null,
    done: 0,
    total: 0,
    now: null,
    activity: []
  }),
  resumeRun: () => ({
    phase: 'running',
    check: null,
    summary: null,
    done: 0,
    total: 0,
    now: null,
    activity: []
  }),
  openRunScreenshot: () => undefined,
  stopRun: () => ({
    phase: 'finished',
    check: null,
    summary: null,
    done: 0,
    total: 0,
    now: null,
    activity: []
  })
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
