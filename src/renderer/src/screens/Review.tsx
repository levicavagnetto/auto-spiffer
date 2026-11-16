import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Alert } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Checkbox } from '../components/ui/checkbox'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle
} from '../components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import type { ReviewLine, ReviewSnapshot } from '../../../shared/review'
import type { RunState } from '../../../shared/run'

type Filter = 'all' | ReviewLine['status']
const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'needs-decision', label: 'Needs a decision' },
  { key: 'not-eligible', label: 'Not eligible' },
  { key: 'possible-wheel', label: 'Wheels' },
  { key: 'not-a-tire', label: 'Not a tire' },
  { key: 'outside-dates', label: 'Outside program dates' }
]
const statusLabels: Record<ReviewLine['status'], string> = {
  ready: 'Ready',
  'needs-decision': 'Needs a decision',
  'not-eligible': 'Not eligible',
  'possible-wheel': 'Possible wheel',
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
  headerActions,
  run,
  onSnapshot,
  onEnter
}: {
  snapshot: ReviewSnapshot | null
  headerActions?: HTMLElement | null
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

  const isFailed = (line: ReviewLine): boolean =>
    Boolean(run?.summary?.failed.some((item) => item.lineId === line.id))
  const statusText = (line: ReviewLine): string =>
    run?.summary?.added.includes(line.id)
      ? 'Entered'
      : run?.summary?.alreadyThere.includes(line.id)
        ? 'On page'
        : isFailed(line)
          ? 'Failed'
          : line.leftOut
            ? 'Left out'
            : statusLabels[line.status]
  const statusClass = (line: ReviewLine): string =>
    isFailed(line)
      ? 'bg-destructive text-destructive-foreground'
      : line.leftOut
        ? 'bg-muted text-foreground'
        : line.status === 'needs-decision'
          ? 'bg-warning text-warning-foreground'
          : line.status === 'possible-wheel'
            ? 'bg-wheel text-wheel-foreground'
            : line.status === 'ready'
              ? 'bg-success text-success-foreground'
              : 'bg-muted text-foreground'

  return (
    <div className="space-y-5">
      {headerActions &&
        createPortal(
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
          </div>,
          headerActions
        )}
      <div>
        <p className="text-sm text-muted-foreground">
          {snapshot.promotion ?? 'Claim page'} ·{' '}
          {snapshot.dates[0] ?? 'Dates unknown'} to{' '}
          {snapshot.dates[1] ?? 'Dates unknown'}
        </p>
      </div>
      {error && (
        <Alert role="alert" variant="destructive">
          {error}
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as Filter)}
        >
          <TabsList aria-label="Filter sales">
            {filters.map((item) => {
              const count =
                item.key === 'all'
                  ? lines.length
                  : lines.filter((line) => line.status === item.key).length
              return (
                <TabsTrigger
                  key={item.key}
                  value={item.key}
                  className="text-xs"
                >
                  {item.label} {count}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
        <Input
          aria-label="Search invoice or tire"
          placeholder="Search invoice or tire"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-auto min-w-52 flex-1 bg-card py-2"
        />
      </div>
      {filter === 'possible-wheel' && (
        <Alert className="p-4 text-muted-foreground">
          These rows look like wheels. Check whether they qualify for ATD Custom
          Wheels or ATD Steel Wheels, then enter them on ProRewards yourself.
        </Alert>
      )}
      <Card className="overflow-auto">
        <Table className="min-w-[900px]">
          <TableHeader className="bg-table-header text-xs text-muted-foreground">
            <TableRow className="border-0">
              <TableHead className="p-3 font-medium">Status</TableHead>
              <TableHead className="p-3 font-medium">Date</TableHead>
              <TableHead className="p-3 font-medium">Invoice</TableHead>
              <TableHead className="p-3 font-medium">On the report</TableHead>
              <TableHead className="p-3 font-medium">Claim page tire</TableHead>
              <TableHead className="p-3 text-right font-medium">Qty</TableHead>
              <TableHead className="p-3 font-medium">PDF</TableHead>
              <TableHead className="p-3 font-medium">This month</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((line) => (
              <TableRow
                key={line.id}
                className={`border-t border-b-0 even:bg-table-alternate ${line.status === 'needs-decision' && !line.leftOut ? 'bg-warning/30' : ''}`}
              >
                <TableCell className="p-3">
                  <Badge className={`font-normal ${statusClass(line)}`}>
                    {statusText(line)}
                  </Badge>
                </TableCell>
                <TableCell className="p-3 whitespace-nowrap">
                  {dateLabel(line.saleDate)}
                </TableCell>
                <TableCell className="p-3 font-mono">{line.invoice}</TableCell>
                <TableCell
                  className="max-w-56 truncate p-3 text-muted-foreground"
                  title={line.description}
                >
                  {line.description}
                </TableCell>
                <TableCell className="p-3">
                  {line.status === 'possible-wheel' ? (
                    <span className="text-muted-foreground">
                      Possible wheel
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="link"
                      size="inline"
                      aria-label={`Review ${line.invoice} ${line.description}`}
                      className="max-w-64 justify-start text-left whitespace-normal"
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
                    </Button>
                  )}
                </TableCell>
                <TableCell className="p-3 text-right">
                  {line.qty}
                  {line.rows.length > 1 ? '*' : ''}
                </TableCell>
                <TableCell className="p-3" title={line.pdf}>
                  {line.pdf ? '✓' : '—'}
                </TableCell>
                <TableCell className="p-3">
                  {line.status === 'possible-wheel' ? (
                    <span className="text-xs text-muted-foreground">
                      Enter by hand
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="link"
                      size="inline"
                      disabled={busy}
                      className="text-xs font-normal"
                      onClick={() => void toggleLeftOut(line)}
                    >
                      {line.leftOut
                        ? 'Include this line'
                        : 'Leave this line out'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {visible.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">
            No sales match this search.
          </p>
        )}
      </Card>
      <p className="text-sm text-muted-foreground">
        {ready.length} ready ({ready.reduce((sum, line) => sum + line.qty, 0)}{' '}
        tires) · {undecided} need a decision ·{' '}
        {
          lines.filter(
            (line) => line.status === 'not-eligible' && !line.leftOut
          ).length
        }{' '}
        not eligible ·{' '}
        {lines.filter((line) => line.status === 'possible-wheel').length}{' '}
        possible wheel ·{' '}
        {lines.filter((line) => line.status === 'not-a-tire').length} not a tire
        {lines.some((line) => line.rows.length > 1)
          ? ' · * Added up from more than one row'
          : ''}
      </p>
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      >
        <SheetContent closeLabel="Close tire choice">
          {selected && (
            <>
              <SheetTitle>Which tire is this?</SheetTitle>
              <SheetDescription className="mt-4">
                Invoice {selected.invoice} · {dateLabel(selected.saleDate)} ·
                qty {selected.qty}
              </SheetDescription>
              <Alert variant="muted" className="mt-4 font-mono">
                {selected.description}
              </Alert>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  `Brand: ${selected.readAs.brand ?? 'Unknown'}`,
                  `Size: ${selected.readAs.sizes.join(', ') || 'Unknown'}`,
                  `Model: ${selected.readAs.words.join(' ') || 'Unknown'}`
                ].map((chip) => (
                  <Badge key={chip} variant="outline" className="font-normal">
                    {chip}
                  </Badge>
                ))}
              </div>
              <Alert variant="warning" className="mt-4">
                {selected.reason}
              </Alert>
              {selected.status !== 'not-a-tire' && (
                <>
                  <RadioGroup
                    aria-label="Tire choice"
                    value={selectedTire}
                    onValueChange={(value) => setSelectedTire(String(value))}
                    className="block"
                  >
                    {selected.suggestions.length > 0 && (
                      <div className="mt-5">
                        <h3 className="text-sm font-semibold">Best guesses</h3>
                        <div className="mt-2 space-y-2">
                          {selected.suggestions.map((suggestion) => (
                            <Label
                              key={suggestion.label}
                              className="cursor-pointer items-start gap-3 rounded-lg border border-border p-3 leading-normal font-normal"
                            >
                              <RadioGroupItem
                                value={suggestion.label}
                                className="mt-0.5"
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
                            </Label>
                          ))}
                        </div>
                      </div>
                    )}
                    <Label className="mt-5 flex-col items-stretch gap-2 font-semibold">
                      Search all claim page tires
                      <Input
                        aria-label="Search all claim page tires"
                        value={tireSearch}
                        onChange={(event) => setTireSearch(event.target.value)}
                        className="font-normal"
                      />
                    </Label>
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border">
                      {tireOptions.map((tire) => (
                        <Label
                          key={tire.label}
                          className="cursor-pointer gap-2 border-b border-border p-2 leading-normal font-normal last:border-0"
                        >
                          <RadioGroupItem value={tire.label} />
                          {tire.label}
                        </Label>
                      ))}
                    </div>
                  </RadioGroup>
                  <Label className="mt-5 font-normal">
                    <Checkbox
                      checked={remember}
                      onCheckedChange={(checked) => setRemember(checked)}
                    />
                    Remember this choice
                  </Label>
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
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
