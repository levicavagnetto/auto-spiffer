import { useEffect, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { Alert } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '../components/ui/collapsible'
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
      <Card
        role="region"
        aria-label="Enter claims panel"
        className="flex min-h-0 flex-col p-5"
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
        <Alert variant="muted" className="mt-4 shrink-0">
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
                <Alert variant="warning-subtle" className="mt-2 rounded-md p-2">
                  Developer trial: this run is limited to the first {runLimit}{' '}
                  sales. Relaunch without the limit before entering the rest.
                </Alert>
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
        </Alert>
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
          <Alert
            role="alert"
            variant="destructive-subtle"
            className="mt-3 shrink-0 rounded-md"
          >
            {error}
          </Alert>
        )}
        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
          <Collapsible
            open={activityExpanded}
            onOpenChange={setActivityExpanded}
            className="overflow-hidden rounded-lg border border-border"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 text-left font-semibold outline-none hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
              <span>Activity</span>
              <span className="text-xs font-normal text-muted-foreground">
                {state.done} sales checked {activityExpanded ? '▴' : '▾'}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent
              id="claim-activity"
              className="max-h-40 overflow-y-auto border-t border-border p-3"
            >
              {summary?.failed.map((item) => (
                <Alert
                  key={item.lineId}
                  variant="destructive-subtle"
                  className="mb-2 rounded-md p-2"
                >
                  Invoice {item.invoice}: {item.reason}
                  {item.screenshot && (
                    <Button
                      type="button"
                      variant="link"
                      size="inline"
                      className="mt-1 flex font-normal underline"
                      onClick={() =>
                        void window.api.openRunScreenshot(item.screenshot!)
                      }
                    >
                      Open page picture
                    </Button>
                  )}
                </Alert>
              ))}
              {summary?.uploadFailed.map((item) => (
                <Alert
                  key={item.invoice}
                  variant="warning-subtle"
                  className="mb-2 rounded-md p-2"
                >
                  Invoice {item.invoice}: PDF upload failed. Upload it by hand.
                </Alert>
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
            </CollapsibleContent>
          </Collapsible>
          <Collapsible
            open={pdfExpanded}
            onOpenChange={setPdfExpanded}
            className="overflow-hidden rounded-lg border border-border"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 p-3 text-left font-semibold outline-none hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
              <span>PDFs needing upload</span>
              <span className="text-xs font-normal text-muted-foreground">
                {missingInvoices.length} invoice
                {missingInvoices.length === 1 ? '' : 's'}{' '}
                {pdfExpanded ? '▴' : '▾'}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border p-3">
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
            </CollapsibleContent>
          </Collapsible>
        </div>
        <p className="mt-4 shrink-0 border-t border-border pt-4 text-xs text-muted-foreground">
          {summary
            ? 'Check the page, then click Next and Submit on the website yourself.'
            : 'Auto Spiffer never clicks Next or Submit. When it finishes, check the page and submit the claim yourself.'}
        </p>
      </Card>
      <Card className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4 text-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Reload website"
            onClick={() => void window.api.reloadSite()}
          >
            <RotateCw className="size-4" />
          </Button>
          <span
            className="min-w-0 flex-1 truncate text-muted-foreground"
            title={site.address}
          >
            {site.address}
          </span>
          {busy && (
            <Badge className="font-normal">Auto Spiffer is typing</Badge>
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
      </Card>
    </div>
  )
}
