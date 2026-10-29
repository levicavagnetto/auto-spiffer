import { ipcMain } from 'electron'
import { dispatchCall } from './ipc-dispatch'
import type { CallHandlers } from '../shared/ipc'

export function registerIpc(
  handlers: CallHandlers,
  log: (message: string) => void
): void {
  ipcMain.handle('app:invoke', (_event, request: unknown) =>
    dispatchCall(request, handlers, log)
  )
}
