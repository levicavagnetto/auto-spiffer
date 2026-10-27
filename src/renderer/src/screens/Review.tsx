import { useState } from 'react'
import { Button } from '../components/ui/button'
import type { ReviewLine, ReviewSnapshot } from '../../../shared/review'
import type { RunState } from '../../../shared/run'

type Filter = 'all' | ReviewLine['status']
const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'needs-decision', label: 'Needs a decision' },
  { key: 'not-eligible', label: 'Not eligible' },
  { key: 'not-a-tire', label: 'Not a tire' },
  { key: 'outside-dates', label: 'Outside program dates' }
]
const statusLabels: Record<ReviewLine['status'], string> = {
  ready: 'Ready',
  'needs-decision': 'Needs a decision',
  'not-eligible': 'Not eligible',
  'not-a-tire': 'Not a tire',
  'outside-dates': 'Outside program dates'
}
function dateLabel(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${date}T00:00:00Z`))
}

export function Review({
  snapshot,
  run,
  onSnapshot,
  onEnter
}: {
  snapshot: ReviewSnapshot | null
  run: RunState | null
  onSnapshot: (next: ReviewSnapshot) => void
  onEnter: () => void
}): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedTire, setSelectedTire] = useState('')
  const [tireSearch, setTireSearch] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!snapshot)
    return (
      <p className="text-sm text-muted-foreground">
        Choose sales and match tires first.
      </p>
    )

  const lines = snapshot.lines
  const ready = lines.filter((line) => line.status === 'ready' && !line.leftOut)
  const undecided = lines.filter(
    (line) => line.status === 'needs-decision' && !line.leftOut
  ).length
  const selected = lines.find((line) => line.id === selectedId)
  const visible = lines.filter(
    (line) =>
      (filter === 'all' || line.status === filter) &&
      (!search ||
        `${line.invoice} ${line.description} ${line.tire ?? line.guess ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase()))
  )
  const tireOptions = snapshot.tires.filter(
    (tire) =>
      tire.kind === 'tire' &&
      tire.label.toLowerCase().includes(tireSearch.toLowerCase())
  )

  const decide = async (label: string | null): Promise<void> => {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      onSnapshot(
        await window.api.decideTire({
          signature: selected.signature,
          label,
          remember
        })
      )
      setSelectedId(null)
    } catch {
      setError('Could not save that tire choice. Try again.')
    } finally {
      setBusy(false)
    }
  }
  const toggleLeftOut = async (line: ReviewLine): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      onSnapshot(
        await window.api.setLineLeftOut({ id: line.id, leftOut: !line.leftOut })
      )
    } catch {
      setError('Could not change that sale. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {snapshot.promotion ?? 'Claim page'} ·{' '}
          {snapshot.dates[0] ?? 'Dates unknown'} to{' '}
          {snapshot.dates[1] ?? 'Dates unknown'}
        </p>
        <div className="flex items-center gap-3">
          {undecided > 0 && (
            <span className="text-sm text-warning-foreground">
              Decide {undecided} tire{undecided === 1 ? '' : 's'} to continue
            </span>
          )}
          <Button
            disabled={undecided > 0 || ready.length === 0}
            onClick={onEnter}
          >
            Enter {ready.length} sale{ready.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive p-3 text-sm text-destructive-foreground"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Filter sales"
          className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
        >
          {filters.map((item) => {
            const count =
              item.key === 'all'
                ? lines.length
                : lines.filter((line) => line.status === item.key).length
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`rounded-md px-3 py-1.5 text-xs ${filter === item.key ? 'bg-card font-semibold text-foreground' : 'text-muted-foreground'}`}
              >
                {item.label} {count}
              </button>
            )
          })}
        </div>
        <input
          aria-label="Search invoice or tire"
          placeholder="Search invoice or tire"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-52 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm"
        />
      </div>
      <div className="overflow-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Status</th>
              <th className="p-3">Date</th>
              <th className="p-3">Invoice</th>
              <th className="p-3">On the report</th>
              <th className="p-3">Claim page tire</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3">PDF</th>
              <th className="p-3">This month</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((line) => (
              <tr
                key={line.id}
                className={`border-t border-border ${line.status === 'needs-decision' && !line.leftOut ? 'bg-warning/30' : ''}`}
              >
                <td className="p-3">
                  <span className="whitespace-nowrap rounded-full bg-muted px-2 py-1 text-xs">
                    {run?.summary?.added.includes(line.id)
                      ? 'Entered'
                      : run?.summary?.alreadyThere.includes(line.id)
                        ? 'On page'
                        : run?.summary?.failed.some(
                              (item) => item.lineId === line.id
                            )
                          ? 'Failed'
                          : line.leftOut
                            ? 'Left out'
                            : statusLabels[line.status]}
                  </span>
                </td>
                <td className="p-3 whitespace-nowrap">
                  {dateLabel(line.saleDate)}
                </td>
                <td className="p-3 font-mono">{line.invoice}</td>
                <td
                  className="max-w-56 truncate p-3 text-muted-foreground"
                  title={line.description}
                >
                  {line.description}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    aria-label={`Review ${line.invoice} ${line.description}`}
                    className="max-w-64 text-left font-medium text-primary hover:underline"
                    onClick={() => {
                      setSelectedId(line.id)
                      setSelectedTire(line.tire ?? line.guess ?? '')
                      setTireSearch('')
                      setRemember(true)
                    }}
                  >
                    {line.tire ??
                      line.guess ??
                      (line.status === 'not-a-tire'
                        ? 'Not a tire'
                        : line.reason)}
                    {line.guess && !line.tire ? ' ?' : ''}
                  </button>
                </td>
                <td className="p-3 text-right">
                  {line.qty}
                  {line.rows.length > 1 ? '*' : ''}
                </td>
                <td className="p-3" title={line.pdf}>
                  {line.pdf ? '✓' : '—'}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    disabled={busy}
                    className="whitespace-nowrap text-xs text-primary hover:underline"
                    onClick={() => void toggleLeftOut(line)}
                  >
                    {line.leftOut ? 'Include this line' : 'Leave this line out'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">
            No sales match this search.
          </p>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {ready.length} ready ({ready.reduce((sum, line) => sum + line.qty, 0)}{' '}
        tires) · {undecided} need a decision ·{' '}
        {
          lines.filter(
            (line) => line.status === 'not-eligible' && !line.leftOut
          ).length
        }{' '}
        not eligible ·{' '}
        {lines.filter((line) => line.status === 'not-a-tire').length} not a tire
        {lines.some((line) => line.rows.length > 1)
          ? ' · * Added up from more than one row'
          : ''}
      </p>
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-[var(--scrim)]"
          onClick={() => setSelectedId(null)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Which tire is this?"
            className="absolute inset-y-0 right-0 w-[440px] max-w-full overflow-y-auto border-l border-border bg-card p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Which tire is this?</h2>
              <button
                type="button"
                aria-label="Close tire choice"
                onClick={() => setSelectedId(null)}
              >
                ✕
              </button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Invoice {selected.invoice} · {dateLabel(selected.saleDate)} · qty{' '}
              {selected.qty}
            </p>
            <p className="mt-4 rounded-lg bg-muted p-3 font-mono text-sm">
              {selected.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {[
                `Brand: ${selected.readAs.brand ?? 'Unknown'}`,
                `Size: ${selected.readAs.sizes.join(', ') || 'Unknown'}`,
                `Model: ${selected.readAs.words.join(' ') || 'Unknown'}`
              ].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-border px-2 py-1"
                >
                  {chip}
                </span>
              ))}
            </div>
            <p className="mt-4 rounded-lg bg-warning p-3 text-sm text-warning-foreground">
              {selected.reason}
            </p>
            {selected.status !== 'not-a-tire' && (
              <>
                {selected.suggestions.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-semibold">Best guesses</h3>
                    <div className="mt-2 space-y-2">
                      {selected.suggestions.map((suggestion) => (
                        <label
                          key={suggestion.label}
                          className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 text-sm"
                        >
                          <input
                            type="radio"
                            name="tire-choice"
                            checked={selectedTire === suggestion.label}
                            onChange={() => setSelectedTire(suggestion.label)}
                          />
                          <span>
                            <strong>{suggestion.label}</strong>
                            <span className="ml-2 text-muted-foreground">
                              {suggestion.score}%
                            </span>
                            <small className="mt-1 block text-muted-foreground">
                              {suggestion.reason}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <label className="mt-5 block text-sm font-semibold">
                  Search all claim page tires
                  <input
                    aria-label="Search all claim page tires"
                    value={tireSearch}
                    onChange={(event) => setTireSearch(event.target.value)}
                    className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 font-normal"
                  />
                </label>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border">
                  {tireOptions.map((tire) => (
                    <label
                      key={tire.label}
                      className="flex cursor-pointer gap-2 border-b border-border p-2 text-sm last:border-0"
                    >
                      <input
                        type="radio"
                        name="tire-choice"
                        checked={selectedTire === tire.label}
                        onChange={() => setSelectedTire(tire.label)}
                      />
                      {tire.label}
                    </label>
                  ))}
                </div>
                <label className="mt-5 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  Remember this choice
                </label>
                <div className="mt-6 flex flex-col gap-2">
                  <Button
                    disabled={busy || !selectedTire}
                    onClick={() => void decide(selectedTire)}
                  >
                    Use {selectedTire ? selectedTire.split(' - ')[0] : 'tire'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void decide(null)}
                  >
                    Not an eligible tire
                  </Button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
