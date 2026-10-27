import { useState } from 'react'
import type { CredentialsState, Theme } from '../../../shared/ipc'
import type { SavedMatchList } from '../../../shared/review'
import type { UpdateState } from '../../../shared/updates'

const choices: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Same as Windows' }
]

export function Settings({
  theme,
  onThemeChange,
  ready,
  savedMatchesOnly = false,
  credentials,
  onCredentials,
  update,
  onUpdate,
  savedMatches = [],
  onRemoveSaved = () => undefined
}: {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  ready: boolean
  savedMatchesOnly?: boolean
  credentials: CredentialsState | null
  onCredentials: (state: CredentialsState) => void
  update: UpdateState | null
  onUpdate: (state: UpdateState) => void
  savedMatches?: SavedMatchList
  onRemoveSaved?: (signature: string) => void
}): React.JSX.Element {
  const [emailDraft, setEmailDraft] = useState<string | null>(null)
  const email = emailDraft ?? credentials?.email ?? ''
  const [password, setPassword] = useState('')
  const [credentialBusy, setCredentialBusy] = useState(false)
  const [credentialMessage, setCredentialMessage] = useState('')
  const [updateMessage, setUpdateMessage] = useState('')
  const [updateBusy, setUpdateBusy] = useState(false)

  const checkForUpdates = async (): Promise<void> => {
    setUpdateBusy(true)
    setUpdateMessage('')
    try {
      onUpdate(await window.api.checkForUpdates())
    } catch (problem) {
      setUpdateMessage(
        problem instanceof Error
          ? problem.message
          : 'Could not check for updates.'
      )
    } finally {
      setUpdateBusy(false)
    }
  }

  const setAutomaticUpdates = async (value: boolean): Promise<void> => {
    try {
      onUpdate(await window.api.setAutomaticUpdates(value))
    } catch {
      setUpdateMessage('Could not save this choice. Try again.')
    }
  }

  const restartToUpdate = async (): Promise<void> => {
    try {
      onUpdate(await window.api.restartToUpdate())
    } catch {
      setUpdateMessage('Could not start the update. Try again.')
    }
  }

  const openLogsFolder = async (): Promise<void> => {
    try {
      await window.api.openLogsFolder()
    } catch {
      setUpdateMessage('Could not open the logs folder.')
    }
  }

  const updateStatus = (() => {
    if (!update) return 'Update status is loading.'
    if (update.phase === 'ready' && update.readyVersion)
      return `Version ${update.readyVersion} is ready`
    if (update.phase === 'checking') return 'Checking for updates…'
    if (update.phase === 'downloading') return 'Downloading an update…'
    if (update.phase === 'up-to-date') {
      return `Auto Spiffer ${update.version} · up to date${update.checkedAt ? ', checked just now' : ''}`
    }
    return `Auto Spiffer ${update.version} · not checked yet`
  })()

  const savePassword = async (): Promise<void> => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setCredentialMessage('Enter a valid email address.')
      return
    }
    if (!password) {
      setCredentialMessage('Enter a password to save.')
      return
    }
    setCredentialBusy(true)
    setCredentialMessage('')
    try {
      onCredentials(
        await window.api.saveCredentials({ email: email.trim(), password })
      )
      setEmailDraft(null)
      setPassword('')
    } catch (problem) {
      setCredentialMessage(
        problem instanceof Error &&
          problem.message.includes('cannot be stored safely')
          ? 'The password cannot be stored safely on this computer.'
          : 'Could not save the password. Try again.'
      )
    } finally {
      setCredentialBusy(false)
    }
  }
  const setStay = async (value: boolean): Promise<void> => {
    setCredentialBusy(true)
    try {
      onCredentials(await window.api.setStaySignedIn(value))
    } catch {
      setCredentialMessage('Could not save this choice. Try again.')
    } finally {
      setCredentialBusy(false)
    }
  }
  const forget = async (): Promise<void> => {
    setCredentialBusy(true)
    try {
      onCredentials(await window.api.forgetCredentials())
      setEmailDraft(null)
      setPassword('')
      setCredentialMessage('Signed out and forgot the saved password.')
    } catch {
      setCredentialMessage('Could not sign out. Try again.')
    } finally {
      setCredentialBusy(false)
    }
  }
  const savedCard = (
    <SavedMatchesCard matches={savedMatches} onRemove={onRemoveSaved} />
  )
  if (savedMatchesOnly) {
    return savedCard
  }

  return (
    <div className="grid max-w-4xl grid-cols-2 gap-5">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">ProRewards sign-in</h2>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            Email
            <input
              type="email"
              value={email}
              disabled={!ready || credentialBusy}
              onChange={(event) => setEmailDraft(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block">
            Password
            <input
              type="password"
              value={password}
              disabled={!ready || credentialBusy}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={credentials?.hasPassword ? 'Saved password' : ''}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          {credentials?.hasPassword && (
            <p className="text-success-foreground">
              Saved, encrypted with your Windows account
            </p>
          )}
          <button
            type="button"
            disabled={!ready || credentialBusy}
            onClick={() => void savePassword()}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
          >
            {credentials?.hasPassword ? 'Change password' : 'Save password'}
          </button>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={credentials?.staySignedIn ?? true}
              disabled={!ready || credentialBusy}
              onChange={(event) => void setStay(event.target.checked)}
            />
            Stay signed in
          </label>
          <button
            type="button"
            disabled={!ready || credentialBusy}
            onClick={() => void forget()}
            className="text-destructive-foreground hover:underline disabled:opacity-50"
          >
            Sign out and forget password
          </button>
          {credentialMessage && <p role="status">{credentialMessage}</p>}
        </div>
      </section>
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Appearance</h2>
        <div className="mt-4 flex flex-col gap-3">
          {choices.map((choice) => (
            <label
              key={choice.value}
              className="flex cursor-pointer items-center gap-3 text-sm"
            >
              <input
                type="radio"
                name="appearance"
                value={choice.value}
                checked={theme === choice.value}
                disabled={!ready}
                onChange={() => onThemeChange(choice.value)}
                className="accent-primary"
              />
              {choice.label}
            </label>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Updates</h2>
        <p className="mt-3 text-sm" role="status">
          {updateStatus}
        </p>
        {update?.restartQueued && (
          <p className="mt-2 text-sm text-muted-foreground">
            It will update when this claim run ends.
          </p>
        )}
        <div className="mt-4 flex flex-col items-start gap-3 text-sm">
          <button
            type="button"
            disabled={!ready || updateBusy}
            onClick={() => void checkForUpdates()}
            className="rounded-md border border-border px-4 py-2 hover:bg-muted disabled:opacity-50"
          >
            Check now
          </button>
          {update?.phase === 'ready' && !update.restartQueued && (
            <button
              type="button"
              onClick={() => void restartToUpdate()}
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
            >
              Restart to update
            </button>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={update?.automatic ?? true}
              disabled={!ready}
              onChange={(event) =>
                void setAutomaticUpdates(event.target.checked)
              }
            />
            Install updates automatically when no claim is being entered
          </label>
          {updateMessage && <p role="alert">{updateMessage}</p>}
        </div>
      </section>
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Logs</h2>
        <button
          type="button"
          onClick={() => void openLogsFolder()}
          className="mt-4 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
        >
          Open folder
        </button>
      </section>
      {savedCard}
    </div>
  )
}

function SavedMatchesCard({
  matches,
  onRemove
}: {
  matches: SavedMatchList
  onRemove: (signature: string) => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const visible = matches.filter((item) =>
    `${item.signature} ${item.label ?? ''} ${item.example}`
      .toLowerCase()
      .includes(query.toLowerCase())
  )
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold">Saved matches</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {matches.length} saved match{matches.length === 1 ? '' : 'es'}
      </p>
      {matches.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No tire matches saved yet.
        </p>
      ) : (
        <>
          <input
            aria-label="Search saved matches"
            placeholder="Search saved matches"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <ul className="mt-3 max-h-80 overflow-auto">
            {visible.map((item) => (
              <li
                key={item.signature}
                className="border-t border-border py-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="font-mono">{item.signature}</strong>
                    <p className="mt-1">
                      {item.label ?? 'Not an eligible tire'}
                      {item.inactive ? (
                        <span className="ml-2 text-warning-foreground">
                          Inactive this month
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.example} · {item.decidedOn}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${item.signature}`}
                    className="text-xs text-destructive-foreground hover:underline"
                    onClick={() => onRemove(item.signature)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
