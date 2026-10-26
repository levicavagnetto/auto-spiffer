import ElectronStore from 'electron-store'
import { existsSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { savedMatchesSchema, type SavedMatchList } from '../../shared/review'
import type { SavedChoices } from './match'

export interface SavedMatchesAccess {
  read(): SavedChoices
  set(signature: string, label: string | null, example: string): void
  remove(signature: string): void
  list(labels: string[] | null): SavedMatchList
}

export function openSavedMatches(
  folder: string,
  log: (message: string) => void,
  notify: (message: string) => void
): SavedMatchesAccess {
  const file = join(folder, 'saved-matches.json')
  if (existsSync(file)) {
    try {
      savedMatchesSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
    } catch (error) {
      const aside = join(folder, `saved-matches.damaged-${Date.now()}.json`)
      renameSync(file, aside)
      log(`Saved matches file was damaged and moved aside: ${String(error)}`)
      notify(
        'Your saved tire matches could not be read. They were set aside, so you will need to choose those tires again.'
      )
    }
  }
  const store = new ElectronStore({
    cwd: folder,
    name: 'saved-matches',
    defaults: { version: 1, entries: {} }
  })
  const read = (): SavedChoices => savedMatchesSchema.parse(store.store).entries
  return {
    read,
    set(signature, label, example) {
      if (!signature || !example.trim())
        throw new Error('A tire description is required.')
      store.set('entries', {
        ...read(),
        [signature]: {
          label,
          example,
          decidedOn: new Date().toISOString().slice(0, 10)
        }
      })
    },
    remove(signature) {
      const entries = { ...read() }
      delete entries[signature]
      store.set('entries', entries)
    },
    list(labels) {
      const active = new Set(labels ?? [])
      return Object.entries(read())
        .map(([signature, choice]) => ({
          signature,
          ...choice,
          inactive:
            labels !== null &&
            choice.label !== null &&
            !active.has(choice.label)
        }))
        .sort((a, b) => a.signature.localeCompare(b.signature))
    }
  }
}
