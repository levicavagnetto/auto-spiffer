import { contextBridge, ipcRenderer } from 'electron'
import { calls, events, type AppApi, type EventName } from '../shared/ipc'

const api = {} as AppApi

for (const name of Object.keys(calls) as (keyof typeof calls)[]) {
  Object.assign(api, {
    [name]: (input?: unknown) =>
      ipcRenderer.invoke('app:invoke', { name, input })
  })
}

api.on = (event, callback) => {
  if (!Object.hasOwn(events, event)) throw new Error('Unknown app event')
  const listener = (
    _ipcEvent: Electron.IpcRendererEvent,
    payload: unknown
  ): void => {
    const parsed = events[event as EventName].safeParse(payload)
    if (parsed.success) callback(parsed.data as never)
  }
  ipcRenderer.on(`app:event:${event}`, listener)
  return () => ipcRenderer.removeListener(`app:event:${event}`, listener)
}

contextBridge.exposeInMainWorld('api', api)
