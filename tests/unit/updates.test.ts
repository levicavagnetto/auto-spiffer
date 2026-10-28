import { describe, expect, it, vi } from 'vitest'
import {
  configureUpdateClient,
  createUpdateController
} from '../../src/main/updates'

function harness() {
  let automatic = true
  let runActive = false
  let tick: () => void = () => undefined
  const check = vi.fn<() => Promise<void>>(async () => undefined)
  const closeSite = vi.fn()
  const install = vi.fn()
  const log = vi.fn()
  const publish = vi.fn()
  const controller = createUpdateController({
    version: '1.0.0',
    automatic: () => automatic,
    saveAutomatic: (value) => {
      automatic = value
    },
    runActive: () => runActive,
    check,
    closeSite,
    install,
    log,
    publish,
    schedule: (callback, delay) => {
      expect(delay).toBe(6 * 60 * 60 * 1000)
      tick = callback
      return () => undefined
    }
  })
  return {
    controller,
    check,
    closeSite,
    install,
    log,
    publish,
    tick: () => tick(),
    setRunActive: (value: boolean) => {
      runActive = value
    }
  }
}

describe('update controller', () => {
  it('checks at startup and every six hours while automatic updates are on', async () => {
    const h = harness()
    h.controller.start()
    await vi.waitFor(() => expect(h.check).toHaveBeenCalledTimes(1))
    h.tick()
    await vi.waitFor(() => expect(h.check).toHaveBeenCalledTimes(2))
    h.controller.setAutomatic(false)
    h.tick()
    expect(h.check).toHaveBeenCalledTimes(2)
    await h.controller.checkNow()
    expect(h.check).toHaveBeenCalledTimes(3)
  })

  it('does not check automatically after the preference is turned off', async () => {
    const h = harness()
    h.controller.setAutomatic(false)
    h.controller.start()
    h.tick()
    expect(h.check).not.toHaveBeenCalled()
    await h.controller.checkNow()
    expect(h.check).toHaveBeenCalledOnce()
  })

  it('logs a failed check and tries again at the next interval', async () => {
    const h = harness()
    h.check.mockRejectedValueOnce(new Error('offline'))
    h.controller.start()
    await vi.waitFor(() => expect(h.log).toHaveBeenCalledOnce())
    expect(h.controller.snapshot().phase).toBe('idle')
    h.tick()
    await vi.waitFor(() => expect(h.check).toHaveBeenCalledTimes(2))
  })

  it('shows a downloaded version and installs only after the run ends', () => {
    const h = harness()
    h.controller.receive({ kind: 'downloaded', version: '1.0.1' })
    expect(h.controller.snapshot()).toMatchObject({
      phase: 'ready',
      readyVersion: '1.0.1'
    })
    h.setRunActive(true)
    h.controller.restartToUpdate()
    expect(h.controller.snapshot().restartQueued).toBe(true)
    expect(h.install).not.toHaveBeenCalled()
    h.setRunActive(false)
    h.controller.onRunStateChanged()
    expect(h.closeSite).toHaveBeenCalledOnce()
    expect(h.install).toHaveBeenCalledOnce()
    expect(h.closeSite.mock.invocationCallOrder[0]).toBeLessThan(
      h.install.mock.invocationCallOrder[0]!
    )
  })

  it('installs a ready update immediately when no claim is running', () => {
    const h = harness()
    h.controller.receive({ kind: 'downloaded', version: '1.0.1' })
    h.controller.restartToUpdate()
    expect(h.install).toHaveBeenCalledOnce()
  })

  it('keeps a downloaded update ready through later checks', async () => {
    const h = harness()
    h.controller.receive({ kind: 'downloaded', version: '1.0.1' })
    await h.controller.checkNow()
    h.controller.receive({ kind: 'not-available' })
    expect(h.controller.snapshot()).toMatchObject({
      phase: 'ready',
      readyVersion: '1.0.1'
    })
  })

  it('does not show a check failure as an app error', () => {
    const h = harness()
    h.controller.receive({ kind: 'error', message: 'network unavailable' })
    expect(h.log).toHaveBeenCalledOnce()
    expect(h.controller.snapshot().phase).toBe('idle')
    expect(h.publish).toHaveBeenCalled()
  })
})

it('uses the matching rc feed for RC builds and keeps stable builds on latest', () => {
  const client = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowPrerelease: true,
    channel: 'other'
  }
  configureUpdateClient(client, '1.0.0')
  expect(client).toMatchObject({
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowPrerelease: false,
    channel: 'latest'
  })
  configureUpdateClient(client, '1.0.0-rc.4')
  expect(client).toMatchObject({ allowPrerelease: true, channel: 'rc' })
  configureUpdateClient(client, '1.0.0', 'rc')
  expect(client).toMatchObject({ allowPrerelease: true, channel: 'rc' })
})
