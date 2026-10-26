import { useState } from 'react'
import type { Theme } from '../../../shared/ipc'
import type { SavedMatchList } from '../../../shared/review'

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
  savedMatches = [],
  onRemoveSaved = () => undefined
}: {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  ready: boolean
  savedMatchesOnly?: boolean
  savedMatches?: SavedMatchList
  onRemoveSaved?: (signature: string) => void
}): React.JSX.Element {
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
        <p className="mt-2 text-sm text-muted-foreground">
          Sign-in settings will appear here.
        </p>
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
