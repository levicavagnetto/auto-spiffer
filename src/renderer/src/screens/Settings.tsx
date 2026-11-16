import { useState } from 'react'
import type { CredentialsState, Theme } from '../../../shared/ipc'
import type { SavedMatchList } from '../../../shared/review'
import type { UpdateState } from '../../../shared/updates'
import { ErrorToast } from '../components/ErrorToast'
import { Button } from '../components/ui/button'
import { Card, CardDescription, CardTitle } from '../components/ui/card'
import { Checkbox } from '../components/ui/checkbox'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group'

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
  const [updateToast, setUpdateToast] = useState('')
  const [updateBusy, setUpdateBusy] = useState(false)

  const checkForUpdates = async (): Promise<void> => {
    setUpdateBusy(true)
    setUpdateToast('')
    setUpdateMessage('')
    try {
      onUpdate(await window.api.checkForUpdates())
    } catch (problem) {
      const detail = problem instanceof Error ? problem.message : ''
      setUpdateToast(
        detail.includes('Install Auto Spiffer to check for updates')
          ? 'Install Auto Spiffer to check for updates'
          : 'Could not check for updates. Try again.'
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
    <>
      {updateToast && (
        <ErrorToast
          message={updateToast}
          onDismiss={() => setUpdateToast('')}
        />
      )}

      <div className="grid max-w-4xl grid-cols-2 items-start gap-5">
        <div className="flex flex-col gap-5">
          <Card className="p-6">
            <CardTitle className="text-base">ProRewards sign-in</CardTitle>
            <div className="mt-4 space-y-3 text-sm">
              <Label className="flex-col items-stretch gap-1 font-normal">
                Email
                <Input
                  type="email"
                  value={email}
                  disabled={!ready || credentialBusy}
                  onChange={(event) => setEmailDraft(event.target.value)}
                />
              </Label>
              <Label className="flex-col items-stretch gap-1 font-normal">
                Password
                <Input
                  type="password"
                  value={password}
                  disabled={!ready || credentialBusy}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={credentials?.hasPassword ? 'Saved password' : ''}
                />
              </Label>
              {credentials?.hasPassword && (
                <p className="text-success-foreground">
                  Saved, encrypted with your Windows account
                </p>
              )}
              <Button
                type="button"
                disabled={!ready || credentialBusy}
                onClick={() => void savePassword()}
              >
                {credentials?.hasPassword ? 'Change password' : 'Save password'}
              </Button>
              <Label className="font-normal">
                <Checkbox
                  checked={credentials?.staySignedIn ?? true}
                  disabled={!ready || credentialBusy}
                  onCheckedChange={(checked) => void setStay(checked)}
                />
                Stay signed in
              </Label>
              <Button
                type="button"
                variant="destructive-link"
                size="inline"
                className="block"
                disabled={!ready || credentialBusy}
                onClick={() => void forget()}
              >
                Sign out and forget password
              </Button>
              {credentialMessage && <p role="status">{credentialMessage}</p>}
            </div>
          </Card>
          <Card className="p-6">
            <CardTitle className="text-base">Updates</CardTitle>
            <p className="mt-3 text-sm" role="status">
              {updateStatus}
            </p>
            {update?.restartQueued && (
              <p className="mt-2 text-sm text-muted-foreground">
                It will update when this claim run ends.
              </p>
            )}
            <div className="mt-4 flex flex-col items-start gap-3 text-sm">
              <Button
                type="button"
                variant="outline"
                disabled={!ready || updateBusy}
                onClick={() => void checkForUpdates()}
              >
                Check now
              </Button>
              {update?.phase === 'ready' && !update.restartQueued && (
                <Button type="button" onClick={() => void restartToUpdate()}>
                  Restart to update
                </Button>
              )}
              <Label className="font-normal">
                <Checkbox
                  checked={update?.automatic ?? true}
                  disabled={!ready}
                  onCheckedChange={(checked) =>
                    void setAutomaticUpdates(checked)
                  }
                />
                Install updates automatically
              </Label>
              {updateMessage && <p role="alert">{updateMessage}</p>}
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Card className="p-6">
            <CardTitle className="text-base">Appearance</CardTitle>
            <RadioGroup
              aria-label="Appearance"
              className="mt-4"
              value={theme}
              disabled={!ready}
              onValueChange={(value) => onThemeChange(value as Theme)}
            >
              {choices.map((choice) => (
                <Label
                  key={choice.value}
                  className="cursor-pointer gap-3 font-normal"
                >
                  <RadioGroupItem value={choice.value} />
                  {choice.label}
                </Label>
              ))}
            </RadioGroup>
          </Card>
          <Card className="p-6">
            <CardTitle className="text-base">Logs</CardTitle>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => void openLogsFolder()}
            >
              Open folder
            </Button>
          </Card>
        </div>
      </div>
    </>
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
    <Card className="p-6">
      <CardTitle className="text-base">Saved matches</CardTitle>
      <CardDescription className="mt-1">
        {matches.length} saved match{matches.length === 1 ? '' : 'es'}
      </CardDescription>
      {matches.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No tire matches saved yet.
        </p>
      ) : (
        <>
          <Input
            aria-label="Search saved matches"
            placeholder="Search saved matches"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-4"
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
                  <Button
                    type="button"
                    variant="destructive-link"
                    size="inline"
                    aria-label={`Remove ${item.signature}`}
                    className="text-xs"
                    onClick={() => onRemove(item.signature)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
