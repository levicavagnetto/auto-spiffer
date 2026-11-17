import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
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

type Filter = 'all' | 'tire' | ReviewLine['status']
type SortKey = 'status' | 'type' | 'date' | 'invoice' | 'report' | 'qty' | 'pdf'
type Sort = { key: SortKey; dir: 'asc' | 'desc' } | null
const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'needs-decision', label: 'Needs a decision' },
  { key: 'not-eligible', label: 'Not eligible' },
  { key: 'tire', label: 'Tires' },
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
  const [form, setForm] = useState<'tire' | 'wheel'>('tire')
  const [sort, setSort] = useState<Sort>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const sheetOpen = selectedId !== null
  useEffect(() => {
    // "/" jumps to the search box, unless the person is already typing somewhere.
    const onKey = (event: KeyboardEvent): void => {
      if (
        event.key !== '/' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        sheetOpen
      )
        return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]'))
        return
      if (!searchRef.current) return
      event.preventDefault()
      searchRef.current.focus()
      searchRef.current.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!snapshot)
    return (
      <p className="text-sm text-muted-foreground">
        Choose sales and match tires first.
      </p>
    )

  const lines = snapshot.lines
  const wheelProducts = snapshot.tires.filter((tire) => tire.kind === 'wheel')
  const isWheelLine = (line: ReviewLine): boolean =>
    line.status === 'possible-wheel' ||
    wheelProducts.some((tire) => tire.label === line.tire)
  const inFilter = (line: ReviewLine, key: Filter): boolean =>
    key === 'all' ||
    (key === 'tire'
      ? line.status !== 'not-a-tire' && !isWheelLine(line)
      : key === 'possible-wheel'
        ? isWheelLine(line)
        : line.status === key)
  const canInclude = (line: ReviewLine): boolean =>
    line.status === 'ready' || line.status === 'needs-decision'
  const ready = lines.filter((line) => line.status === 'ready' && !line.leftOut)
  const undecided = lines.filter(
    (line) => line.status === 'needs-decision' && !line.leftOut
  ).length
  const selected = lines.find((line) => line.id === selectedId)
  const visible = lines.filter(
    (line) =>
      inFilter(line, filter) &&
      (!search ||
        `${line.invoice} ${line.description} ${line.tire ?? line.guess ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase()))
  )
  const sortValue = (line: ReviewLine, key: SortKey): string | number => {
    switch (key) {
      case 'status':
        return statusText(line)
      case 'type':
        return line.status === 'not-a-tire'
          ? ''
          : isWheelLine(line)
            ? 'Wheel'
            : 'Tire'
      case 'date':
        return line.saleDate
      case 'invoice':
        return line.invoice
      case 'report':
        return line.description
      case 'qty':
        return line.qty
      case 'pdf':
        return line.pdf ? 1 : 0
    }
  }
  const sorted = sort
    ? [...visible].sort((a, b) => {
        const x = sortValue(a, sort.key)
        const y = sortValue(b, sort.key)
        const order =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y), undefined, { numeric: true })
        return sort.dir === 'asc' ? order : -order
      })
    : visible
  const toggleSort = (key: SortKey): void =>
    setSort((current) =>
      current?.key !== key
        ? { key, dir: 'asc' }
        : current.dir === 'asc'
          ? { key, dir: 'desc' }
          : null
    )
  const sortHead = (
    key: SortKey,
    label: string,
    className = ''
  ): React.JSX.Element => {
    const active = sort?.key === key ? sort.dir : null
    const Icon =
      active === 'asc'
        ? ArrowUp
        : active === 'desc'
          ? ArrowDown
          : ChevronsUpDown
    return (
      <TableHead
        className={`p-3 font-medium ${className}`}
        aria-sort={
          active === 'asc'
            ? 'ascending'
            : active === 'desc'
              ? 'descending'
              : 'none'
        }
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className={`inline-flex cursor-pointer items-center gap-1 rounded outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${active ? 'text-foreground' : ''}`}
        >
          {label}
          <Icon
            className={`size-3.5 ${active ? '' : 'opacity-50'}`}
            aria-hidden="true"
          />
        </button>
      </TableHead>
    )
  }
  const includable = visible.filter(canInclude)
  const includedCount = includable.filter((line) => !line.leftOut).length
  const openLine = (line: ReviewLine): void => {
    setSelectedId(line.id)
    setSelectedTire(line.tire ?? line.guess ?? '')
    setTireSearch('')
    setRemember(true)
    setForm(isWheelLine(line) ? 'wheel' : 'tire')
  }
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
        await window.api.decideLine({
          signature: selected.signature,
          label,
          remember
        })
      )
      setSelectedId(null)
    } catch {
      setError('Could not save that choice. Try again.')
    } finally {
      setBusy(false)
    }
  }
  const setLeftOut = async (ids: string[], leftOut: boolean): Promise<void> => {
    if (!ids.length) return
    setBusy(true)
    setError('')
    try {
      onSnapshot(await window.api.setLinesLeftOut({ ids, leftOut }))
    } catch {
      setError('Could not change that sale. Try again.')
    } finally {
      setBusy(false)
    }
  }

  // Function declarations so the sort code above can call them.
  function isFailed(line: ReviewLine): boolean {
    return Boolean(run?.summary?.failed.some((item) => item.lineId === line.id))
  }
  function statusText(line: ReviewLine): string {
    return run?.summary?.added.includes(line.id)
      ? 'Entered'
      : run?.summary?.alreadyThere.includes(line.id)
        ? 'On page'
        : isFailed(line)
          ? 'Failed'
          : line.leftOut
            ? 'Left out'
            : statusLabels[line.status]
  }
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
                  : lines.filter((line) => inFilter(line, item.key)).length
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
        <div className="relative min-w-52 flex-1">
          <Input
            ref={searchRef}
            aria-keyshortcuts="/"
            title="Press / to search"
            aria-label="Search invoice or tire"
            placeholder="Search invoice or tire"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-auto w-full bg-card py-2 pr-9"
          />
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded border border-border bg-muted font-mono text-xs text-muted-foreground"
          >
            /
          </kbd>
        </div>
      </div>
      {filter === 'possible-wheel' && (
        <Alert className="p-4 text-muted-foreground">
          Open a wheel and choose ATD Custom Wheels or ATD Steel Wheels to have
          it entered. Wheels nobody chooses are not entered.
        </Alert>
      )}
      <Card className="overflow-auto">
        <Table className="min-w-[760px]">
          <TableHeader className="bg-table-header text-xs text-muted-foreground">
            <TableRow className="border-0">
              <TableHead className="w-10 p-3">
                <Checkbox
                  aria-label="Include all"
                  disabled={busy || includable.length === 0}
                  checked={
                    includable.length > 0 && includedCount === includable.length
                  }
                  indeterminate={
                    includedCount > 0 && includedCount < includable.length
                  }
                  onCheckedChange={(checked) =>
                    void setLeftOut(
                      includable
                        .filter((line) => line.leftOut === checked)
                        .map((line) => line.id),
                      !checked
                    )
                  }
                />
              </TableHead>
              {sortHead('status', 'Status')}
              {sortHead('type', 'Type')}
              {sortHead('date', 'Date')}
              {sortHead('invoice', 'Invoice')}
              {sortHead('report', 'On the report')}
              {sortHead('qty', 'Qty', 'text-right')}
              {sortHead('pdf', 'PDF')}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((line) => (
              <TableRow
                key={line.id}
                onClick={() => openLine(line)}
                className={`cursor-pointer border-t border-b-0 even:bg-table-alternate hover:bg-muted ${line.status === 'needs-decision' && !line.leftOut ? 'bg-warning/30' : ''}`}
              >
                <TableCell
                  className="p-3"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {canInclude(line) && (
                    <Checkbox
                      aria-label={`Include ${line.invoice} ${line.description}`}
                      disabled={busy}
                      checked={!line.leftOut}
                      onCheckedChange={(checked) =>
                        void setLeftOut([line.id], !checked)
                      }
                    />
                  )}
                </TableCell>
                <TableCell className="p-3">
                  <Badge className={`font-normal ${statusClass(line)}`}>
                    {statusText(line)}
                  </Badge>
                </TableCell>
                <TableCell className="p-3">
                  {line.status !== 'not-a-tire' &&
                    (isWheelLine(line) ? (
                      <Badge className="bg-type-wheel font-normal text-type-wheel-foreground">
                        Wheel
                      </Badge>
                    ) : (
                      <Badge className="bg-type-tire font-normal text-type-tire-foreground">
                        Tire
                      </Badge>
                    ))}
                </TableCell>
                <TableCell className="p-3 whitespace-nowrap">
                  {dateLabel(line.saleDate)}
                </TableCell>
                <TableCell className="p-3 font-mono">{line.invoice}</TableCell>
                <TableCell className="max-w-80 p-3">
                  <button
                    type="button"
                    aria-label={`Review ${line.invoice} ${line.description}`}
                    className="block w-full cursor-pointer text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span
                      className="block truncate text-muted-foreground"
                      title={line.description}
                    >
                      {line.description}
                    </span>
                    <span
                      className={`block truncate text-xs ${line.status === 'ready' ? 'font-medium text-foreground' : line.guess && !line.tire ? 'text-warning-foreground' : 'text-muted-foreground'}`}
                    >
                      {line.tire ??
                        (line.guess
                          ? `${line.guess} ?`
                          : line.status === 'possible-wheel'
                            ? 'Possible wheel'
                            : line.status === 'not-a-tire'
                              ? 'Not a tire'
                              : line.reason)}
                    </span>
                  </button>
                </TableCell>
                <TableCell className="p-3 text-right">
                  {line.qty}
                  {line.rows.length > 1 ? '*' : ''}
                </TableCell>
                <TableCell className="p-3" title={line.pdf}>
                  {line.pdf ? '✓' : '—'}
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
        items) · {undecided} need a decision ·{' '}
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
              <SheetTitle>
                {form === 'wheel'
                  ? 'Which wheel is this?'
                  : 'Which tire is this?'}
              </SheetTitle>
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
              {form === 'wheel' && (
                <>
                  {wheelProducts.length === 0 ? (
                    <Alert variant="warning" className="mt-5">
                      This month&apos;s claim page has no wheel products, so
                      wheels can&apos;t be entered.
                    </Alert>
                  ) : (
                    <RadioGroup
                      aria-label="Wheel product"
                      value={selectedTire}
                      onValueChange={(value) => setSelectedTire(String(value))}
                      className="mt-5 space-y-2"
                    >
                      {wheelProducts.map((wheel) => (
                        <Label
                          key={wheel.label}
                          className="cursor-pointer gap-3 rounded-lg border border-border p-3 leading-normal font-normal"
                        >
                          <RadioGroupItem value={wheel.label} />
                          {wheel.label}
                        </Label>
                      ))}
                    </RadioGroup>
                  )}
                  <Label className="mt-5 font-normal">
                    <Checkbox
                      checked={remember}
                      onCheckedChange={(checked) => setRemember(checked)}
                    />
                    Remember this choice
                  </Label>
                  <div className="mt-6 flex flex-col gap-2">
                    {wheelProducts.length > 0 && (
                      <Button
                        disabled={
                          busy ||
                          !wheelProducts.some(
                            (wheel) => wheel.label === selectedTire
                          )
                        }
                        onClick={() => void decide(selectedTire)}
                      >
                        Use{' '}
                        {wheelProducts.some(
                          (wheel) => wheel.label === selectedTire
                        )
                          ? selectedTire
                          : 'wheel'}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void decide(null)}
                    >
                      Not an eligible wheel
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setForm('tire')
                        setSelectedTire('')
                      }}
                    >
                      This is a tire
                    </Button>
                  </div>
                </>
              )}
              {form === 'tire' && selected.status !== 'not-a-tire' && (
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
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setForm('wheel')
                        setSelectedTire('')
                      }}
                    >
                      This is a wheel
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
