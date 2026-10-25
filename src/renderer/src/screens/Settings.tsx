import type { Theme } from '../../../shared/ipc'

const choices: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Same as Windows' }
]

export function Settings({
  theme,
  onThemeChange,
  ready,
  savedMatchesOnly = false
}: {
  theme: Theme
  onThemeChange: (theme: Theme) => void
  ready: boolean
  savedMatchesOnly?: boolean
}): React.JSX.Element {
  if (savedMatchesOnly) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Saved matches</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No tire matches saved yet.
        </p>
      </section>
    )
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
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Saved matches</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No tire matches saved yet.
        </p>
      </section>
    </div>
  )
}
