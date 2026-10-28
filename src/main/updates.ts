import type { UpdateState } from '../shared/updates'

type UpdateSignal =
  | { kind: 'available'; version: string }
  | { kind: 'downloaded'; version: string }
  | { kind: 'not-available' }
  | { kind: 'progress' }
  | { kind: 'error'; message: string }

type Dependencies = {
  version: string
  automatic: () => boolean
  saveAutomatic: (value: boolean) => void
  runActive: () => boolean
  check: () => Promise<void>
  closeSite: () => void
  install: () => void
  log: (message: string) => void
  publish: (state: UpdateState) => void
  schedule: (callback: () => void, delay: number) => () => void
}

export function configureUpdateClient(
  client: {
    autoDownload: boolean
    autoInstallOnAppQuit: boolean
    allowPrerelease: boolean
    channel: string | null
  },
  version: string,
  channelOverride?: string
): void {
  const prerelease =
    /^\d+\.\d+\.\d+-rc\.\d+$/.test(version) || channelOverride === 'rc'
  client.autoDownload = true
  client.autoInstallOnAppQuit = true
  client.allowPrerelease = prerelease
  client.channel = prerelease ? 'rc' : 'latest'
}

export function createUpdateController(deps: Dependencies) {
  let state: UpdateState = {
    phase: 'idle',
    version: deps.version,
    readyVersion: null,
    checkedAt: null,
    automatic: deps.automatic(),
    restartQueued: false
  }
  let checking = false
  let installing = false
  let cancelSchedule: (() => void) | null = null
  const publish = (): void => deps.publish({ ...state })
  const install = (): void => {
    if (installing || state.phase !== 'ready' || deps.runActive()) return
    installing = true
    deps.closeSite()
    deps.install()
  }

  return {
    snapshot: (): UpdateState => ({ ...state }),
    start(): void {
      if (cancelSchedule) return
      cancelSchedule = deps.schedule(
        () => {
          if (state.automatic) void this.checkNow()
        },
        6 * 60 * 60 * 1000
      )
      if (state.automatic) void this.checkNow()
    },
    dispose(): void {
      cancelSchedule?.()
      cancelSchedule = null
    },
    async checkNow(): Promise<void> {
      if (checking || state.phase === 'ready') return
      checking = true
      state = { ...state, phase: 'checking' }
      publish()
      try {
        await deps.check()
        if (state.phase === 'checking') {
          state = {
            ...state,
            phase: 'up-to-date',
            checkedAt: new Date().toISOString()
          }
          publish()
        }
      } catch (error) {
        deps.log(`Update check failed: ${String(error)}`)
        if (state.phase !== 'ready') state = { ...state, phase: 'idle' }
        publish()
      } finally {
        checking = false
      }
    },
    setAutomatic(value: boolean): UpdateState {
      deps.saveAutomatic(value)
      state = { ...state, automatic: value }
      publish()
      if (value) void this.checkNow()
      return this.snapshot()
    },
    receive(signal: UpdateSignal): void {
      switch (signal.kind) {
        case 'available':
        case 'progress':
          state = { ...state, phase: 'downloading' }
          break
        case 'downloaded':
          state = { ...state, phase: 'ready', readyVersion: signal.version }
          break
        case 'not-available':
          if (state.phase !== 'ready')
            state = {
              ...state,
              phase: 'up-to-date',
              checkedAt: new Date().toISOString()
            }
          break
        case 'error':
          deps.log(`Update failed: ${signal.message}`)
          if (state.phase !== 'ready') state = { ...state, phase: 'idle' }
          break
      }
      publish()
      if (state.restartQueued && !deps.runActive()) install()
    },
    restartToUpdate(): UpdateState {
      if (state.phase !== 'ready')
        throw new Error('No update is ready to install.')
      if (deps.runActive()) {
        state = { ...state, restartQueued: true }
        publish()
      } else install()
      return this.snapshot()
    },
    onRunStateChanged(): void {
      if (state.restartQueued && !deps.runActive()) install()
    }
  }
}

export type UpdateController = ReturnType<typeof createUpdateController>
