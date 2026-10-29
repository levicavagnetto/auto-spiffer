import { useEffect, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Progress } from '../components/ui/progress'
import type { ReviewSnapshot } from '../../../shared/review'
import type { RunState } from '../../../shared/run'
import type { SiteStatus } from '../../../shared/ipc'

const empty: RunState = {
  phase: 'idle',
  check: null,
  summary: null,
  done: 0,
  total: 0,
  now: null,
  activity: []
}
export function EnterClaims({
  review,
  run
}: {
  review: ReviewSnapshot | null
  run: RunState | null
}): React.JSX.Element {
  const slot = useRef<HTMLDivElement>(null)
  const [local, setLocal] = useState<RunState>(empty)
  const [site, setSite] = useState<SiteStatus>({
    address: '',
    state: 'notOpened'
  })
  const [error, setError] = useState('')
  const [runLimit, setRunLimit] = useState<number | null>(null)
  const [activityExpanded, setActivityExpanded] = useState(false)
  const [pdfExpanded, setPdfExpanded] = useState(Boolean(run?.summary))
  const [copyFeedback, setCopyFeedback] = useState('')
  const wasFinished = useRef(Boolean(run?.summary))
  const state = run ?? local
  const ready =
    review?.lines.filter((line) => line.status === 'ready' && !line.leftOut) ??
    []
  const now = ready.find((line) => line.id === state.now)
  const busy =
    state.phase === 'running' ||
    state.phase === 'paused' ||
    state.phase === 'checking'
  const summary = state.summary

  useEffect(() => {
    const finished = Boolean(summary)
    if (finished && !wasFinished.current) {
      setPdfExpanded(true)
      setActivityExpanded(false)
    } else if (!finished && wasFinished.current) {
      setPdfExpanded(false)
      setActivityExpanded(false)
      setCopyFeedback('')
    }
    wasFinished.current = finished
  }, [summary])

  const total = state.total || ready.length
  const position = summary
    ? state.done
    : busy && state.now
      ? Math.min(state.done + 1, total)
      : state.done
  const phaseLabel = summary
    ? summary.stopped
      ? 'Run stopped'
      : 'Finished entering'
    : state.phase === 'checking'
      ? 'Checking claim page'
      : state.phase === 'paused'
        ? 'Paused'
        : busy
          ? 'Entering sales'
          : 'Ready to enter'
  const missingInvoices = Array.from(
    new Set(
      summary
        ? [
            ...ready.filter((line) => !line.pdf).map((line) => line.invoice),
            ...summary.missingPdfs,
            ...summary.uploadFailed.map((item) => item.invoice)
          ]
        : busy
          ? state.activity
              .filter(
                (item) =>
                  item.kind === 'missingPdf' || item.kind === 'uploadFailed'
              )
              .map(
                (item) => ready.find((line) => line.id === item.lineId)?.invoice
              )
              .filter((invoice): invoice is string => Boolean(invoice))
          : ready.filter((line) => !line.pdf).map((line) => line.invoice)
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const activity = state.activity.filter(
    (item) =>
      item.kind !== 'missingPdf' &&
      (!summary || (item.kind !== 'failed' && item.kind !== 'uploadFailed'))
  )
  const copyInvoice = async (invoice: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(invoice)
      setCopyFeedback(`Copied invoice ${invoice}.`)
    } catch {
      setCopyFeedback(`Could not copy invoice ${invoice}.`)
    }
  }

  useEffect(() => {
    void window.api.getRunState().then(setLocal)
    void window.api.getSiteStatus().then(setSite)
    void window.api.getRunLimit().then(setRunLimit)
    const unsubRun = window.api.on('runStateChanged', setLocal)
    const unsubSite = window.api.on('siteStatusChanged', setSite)
    return () => {
      unsubRun()
      unsubSite()
    }
  }, [])
  useEffect(() => {
    const element = slot.current
    if (!element) return
    const update = (): void => {
      const rect = element.getBoundingClientRect()
      void window.api.setSiteBounds({
        x: Math.max(0, Math.round(rect.x)),
        y: Math.max(0, Math.round(rect.y)),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height))
      })
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    window.addEventListener('resize', update)
    update()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      void window.api.setSiteBounds(null)
    }
  }, [])
  const call = async (action: () => Promise<RunState>): Promise<void> => {
    setError('')
    try {
      setLocal(await action())
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message.replace(
              /^Error invoking remote method .*?: Error: /,
              ''
            )
          : ''
      setError(
        message && !message.startsWith('Error invoking remote method')
          ? message
          : 'Could not continue. Check the claim page and try again.'
      )
    }
  }
  return (
    <div className="grid h-[calc(100vh-124px)] min-h-[500px] gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section
        aria-label="Enter claims panel"
        className="flex min-h-0 flex-col rounded-xl border border-border bg-card p-5"
      >
        <h2 className="shrink-0 text-2xl font-semibold">
          {position} of {total} sales
        </h2>
        <Progress
          className="mt-4 w-full shrink-0"
          value={state.done}
          max={total || 1}
          aria-label="Sales entered"
        />
        <p className="mt-2 shrink-0 text-xs text-muted-foreground">
          {phaseLabel}
        </p>
        <div className="mt-4 shrink-0 rounded-lg bg-muted p-3 text-sm">
          {summary ? (
            <>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Run results
              </p>
              <p className="mt-1 font-semibold">
                {summary.added.length} entered · {summary.alreadyThere.length}{' '}
                already on page
              </p>
              <p className="mt-1 text-muted-foreground">
                {summary.uploaded.length} PDFs uploaded
              </p>
            </>
          ) : busy ? (
            <>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Now entering
              </p>
              {now ? (
                <>
                  <p className="mt-1 font-semibold">Invoice {now.invoice}</p>
                  <p className="mt-1 text-muted-foreground">
                    {now.tire} · qty {now.qty}
                  </p>
                </>
              ) : (
                <p className="mt-1">
                  {state.phase === 'checking'
                    ? 'Checking the claim page…'
                    : 'Finishing this invoice…'}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Plan
              </p>
              <p className="mt-1">
                {ready.length} sale{ready.length === 1 ? '' : 's'} ·{' '}
                {
                  new Set(
                    ready.filter((line) => line.pdf).map((line) => line.invoice)
                  ).size
                }{' '}
                invoice PDFs
              </p>
              {runLimit && (
                <p className="mt-2 rounded-md bg-warning/30 p-2">
                  Developer trial: this run is limited to the first {runLimit}{' '}
                  sales. Relaunch without the limit before entering the rest.
                </p>
              )}
              {!ready.length && (
                <p className="mt-2 text-muted-foreground">
                  No sales are ready to enter.
                </p>
              )}
            </>
          )}
          {state.check && (
            <div className="mt-3 border-t border-border pt-2 text-xs">
              <p className="font-semibold">
                {state.check.ok
                  ? 'Page check passed'
                  : 'Page check needs attention'}
              </p>
              <p className="mt-1 text-muted-foreground">
                {state.check.program ?? 'Program unknown'} ·{' '}
                {state.check.dates[0] ?? '?'} to {state.check.dates[1] ?? '?'}
              </p>
              {state.check.problems.map((problem) => (
                <p key={problem} className="mt-1">
                  {problem}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 flex shrink-0 gap-2">
          {summary ? (
            <Button
              className="w-full"
              onClick={() => void call(() => window.api.startRun())}
            >
              Check page and run again
            </Button>
          ) : busy ? (
            <>
              <Button
                variant="outline"
                disabled={state.phase === 'checking'}
                onClick={() =>
                  void call(
                    state.phase === 'paused'
                      ? () => window.api.resumeRun()
                      : () => window.api.pauseRun()
                  )
                }
              >
                {state.phase === 'paused' ? 'Resume' : 'Pause'}
              </Button>
              <Button
                variant="outline"
                disabled={state.phase === 'checking'}
                onClick={() => void call(() => window.api.stopRun())}
              >
                Stop
              </Button>
            </>
          ) : (
            <Button
              disabled={!ready.length}
              onClick={() => void call(() => window.api.startRun())}
            >
              Start entering
            </Button>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="mt-3 shrink-0 rounded-md bg-destructive/10 p-3 text-sm"
          >
            {error}
          </p>
        )}
        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
          <div className="overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              aria-expanded={activityExpanded}
              aria-controls="claim-activity"
              onClick={() => setActivityExpanded((open) => !open)}
              className="flex w-full items-center justify-between gap-2 p-3 text-left font-semibold hover:bg-muted"
            >
              <span>Activity</span>
              <span className="text-xs font-normal text-muted-foreground">
                {state.done} sales checked {activityExpanded ? '▴' : '▾'}
              </span>
            </button>
            {activityExpanded && (
              <div
                id="claim-activity"
                className="max-h-40 overflow-y-auto border-t border-border p-3"
              >
                {summary?.failed.map((item) => (
                  <div
                    key={item.lineId}
                    className="mb-2 rounded-md bg-destructive/10 p-2"
                  >
                    Invoice {item.invoice}: {item.reason}
                    {item.screenshot && (
                      <button
                        type="button"
                        className="mt-1 block text-primary underline"
                        onClick={() =>
                          void window.api.openRunScreenshot(item.screenshot!)
                        }
                      >
                        Open page picture
                      </button>
                    )}
                  </div>
                ))}
                {summary?.uploadFailed.map((item) => (
                  <p
                    key={item.invoice}
                    className="mb-2 rounded-md bg-warning/30 p-2"
                  >
                    Invoice {item.invoice}: PDF upload failed. Upload it by
                    hand.
                  </p>
                ))}
                {activity.length > 0 ? (
                  <ol className="space-y-2">
                    {activity.map((item, index) => (
                      <li
                        key={`${item.lineId}-${index}`}
                        className="rounded-md bg-muted p-2"
                      >
                        {item.text}
                      </li>
                    ))}
                  </ol>
                ) : !summary?.failed.length && !summary?.uploadFailed.length ? (
                  <p className="text-muted-foreground">No activity yet.</p>
                ) : null}
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              aria-expanded={pdfExpanded}
              aria-controls="pdf-invoice-list"
              onClick={() => setPdfExpanded((open) => !open)}
              className="flex w-full items-center justify-between gap-2 p-3 text-left font-semibold hover:bg-muted"
            >
              <span>PDFs needing upload</span>
              <span className="text-xs font-normal text-muted-foreground">
                {missingInvoices.length} invoice
                {missingInvoices.length === 1 ? '' : 's'}{' '}
                {pdfExpanded ? '▴' : '▾'}
              </span>
            </button>
            {pdfExpanded && (
              <div className="border-t border-border p-3">
                <p className="mb-3 text-xs text-muted-foreground">
                  {missingInvoices.length
                    ? 'Upload these PDFs on ProRewards. Click an invoice number to copy it.'
                    : 'No PDFs need uploading.'}
                </p>
                {missingInvoices.length > 0 && (
                  <div
                    id="pdf-invoice-list"
                    role="region"
                    aria-label="PDF invoice list"
                    tabIndex={0}
                    className="flex max-h-40 flex-wrap gap-2 overflow-y-auto"
                  >
                    {missingInvoices.map((invoice) => (
                      <Button
                        key={invoice}
                        variant="outline"
                        size="sm"
                        className="font-mono"
                        aria-label={`Copy invoice ${invoice}`}
                        onClick={() => void copyInvoice(invoice)}
                      >
                        {invoice}
                      </Button>
                    ))}
                  </div>
                )}
                <p role="status" className="mt-2 min-h-4 text-xs">
                  {copyFeedback}
                </p>
              </div>
            )}
          </div>
        </div>
        <p className="mt-4 shrink-0 border-t border-border pt-4 text-xs text-muted-foreground">
          {summary
            ? 'Check the page, then click Next and Submit on the website yourself.'
            : 'Auto Spiffer never clicks Next or Submit. When it finishes, check the page and submit the claim yourself.'}
        </p>
      </section>
      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4 text-sm">
          <button
            type="button"
            aria-label="Reload website"
            onClick={() => void window.api.reloadSite()}
            className="rounded-md p-1.5 hover:bg-muted"
          >
            <RotateCw className="size-4" />
          </button>
          <span
            className="min-w-0 flex-1 truncate text-muted-foreground"
            title={site.address}
          >
            {site.address}
          </span>
          {busy && (
            <span className="rounded-full bg-muted px-2 py-1 text-xs">
              Auto Spiffer is typing
            </span>
          )}
        </div>
        <div
          ref={slot}
          aria-label="ProRewards website"
          className="min-h-0 flex-1"
        />
        <div
          aria-label="Website bottom bar"
          className="h-4 shrink-0 border-t border-border bg-card"
        />
      </section>
    </div>
  )
}
