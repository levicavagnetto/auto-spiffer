import ElectronStore from 'electron-store'
import { settingsSchema, themeSchema } from '../shared/ipc'
import type { Settings, Theme } from '../shared/ipc'

export interface SettingsAccess {
  read(): Settings
  setTheme(theme: Theme): Settings
  setWindowBounds(bounds: Settings['windowBounds']): Settings
}

const defaults: Settings = {
  theme: 'system',
  windowBounds: { width: 1280, height: 800 }
}

export function openSettings(
  folder: string,
  log: (message: string) => void
): SettingsAccess {
  const store = new ElectronStore<Settings>({
    cwd: folder,
    name: 'settings',
    defaults,
    clearInvalidConfig: true,
    deserialize: (text) => {
      try {
        return settingsSchema.parse(JSON.parse(text))
      } catch {
        log('Settings file was damaged; defaults restored')
        throw new SyntaxError('Invalid settings file')
      }
    }
  })

  const read = (): Settings => settingsSchema.parse(store.store)

  return {
    read,
    setTheme(theme) {
      store.set('theme', themeSchema.parse(theme))
      return read()
    },
    setWindowBounds(bounds) {
      store.set('windowBounds', {
        width: Math.max(1100, Math.round(bounds.width)),
        height: Math.max(700, Math.round(bounds.height))
      })
      return read()
    }
  }
}
