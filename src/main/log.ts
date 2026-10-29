import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log'

const logMessage = 'Something went wrong. Details were saved to the log.'

export function configureLog(userData: string): typeof log {
  const folder = join(userData, 'logs')
  mkdirSync(folder, { recursive: true })
  const mainLog = join(folder, 'main.log')
  log.transports.file.resolvePathFn = () => mainLog
  log.transports.file.maxSize = 5 * 1024 * 1024
  log.transports.file.archiveLogFn = () => {
    const oldest = join(folder, 'main.4.log')
    if (existsSync(oldest)) rmSync(oldest)
    for (let number = 3; number >= 1; number--) {
      const previous = join(folder, `main.${number}.log`)
      if (existsSync(previous))
        renameSync(previous, join(folder, `main.${number + 1}.log`))
    }
    if (existsSync(mainLog)) renameSync(mainLog, join(folder, 'main.1.log'))
  }
  return log
}

export function reportUnexpected(
  error: unknown,
  writeLog: (error: Error) => void,
  sendToScreen: (message: string) => void
): void {
  writeLog(error instanceof Error ? error : new Error(String(error)))
  sendToScreen(logMessage)
}
