import { useEffect, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { Button } from '../components/ui/button'
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
  const state = run ?? local
  const ready =
    review?.lines.filter((line) => line.status === 'ready' && !line.leftOut) ??
    []
  const now = ready.find((line) => line.id === state.now)
  const busy =
    state.phase === 'running' ||
    state.phase === 'paused' ||
    state.phase === 'checking'

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
  const summary = state.summary
  return (
    <div className="grid h-[calc(100vh-124px)] min-h-[500px] gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card p-5">
        {summary ? (
          <>
            <h2 className="text-lg font-semibold">
              {summary.stopped ? 'Run stopped' : 'Finished entering'}
            </h2>
            <div className="mt-4 shrink-0 space-y-1 text-sm">
              <p>
                {summary.added.length} entered · {summary.alreadyThere.length}{' '}
                already on the page
              </p>
              <p>{summary.uploaded.length} PDFs uploaded</p>
            </div>
            <div
              role="region"
              aria-label="Run details"
              tabIndex={0}
              className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm"
            >
              {summary.failed.map((item) => (
                <div
                  key={item.lineId}
                  className="rounded-md bg-destructive/10 p-2"
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
              {summary.uploadFailed.map((item) => (
                <p key={item.invoice} className="rounded-md bg-warning/30 p-2">
                  Invoice {item.invoice}: PDF upload failed. Upload it by hand.
                </p>
              ))}
              {summary.missingPdfs.length > 0 && (
                <div className="rounded-md bg-warning/30 p-3">
                  <h3 className="font-semibold">
                    PDFs to upload yourself ({summary.missingPdfs.length})
                  </h3>
                  <p className="mt-1 text-muted-foreground">
                    No PDF was selected for these invoices. Upload them on the
                    website.
                  </p>
                  <ul className="mt-2 divide-y divide-border">
                    {summary.missingPdfs.map((invoice) => (
                      <li key={invoice} className="py-1.5 font-mono">
                        Invoice {invoice}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <Button
              className="mt-4 shrink-0"
              onClick={() => void call(() => window.api.startRun())}
            >
              Check page and run again
            </Button>
            <p className="mt-4 shrink-0 text-sm">
              Check the page, then click Next and Submit on the website
              yourself.
            </p>
          </>
        ) : busy ? (
          <>
            <h2 className="text-2xl font-semibold">
              {state.now ? Math.min(state.done + 1, state.total) : state.done}{' '}
              of {state.total} sales
            </h2>
            <progress
              className="mt-4 w-full"
              value={state.done}
              max={state.total || 1}
            />
            <p className="mt-4 text-sm">
              {now
                ? `Now: ${now.invoice} · ${now.tire} · qty ${now.qty}`
                : state.phase === 'checking'
                  ? 'Checking the claim page…'
                  : 'Finishing this invoice…'}
            </p>
            <div className="mt-5 flex gap-2">
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
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold">Ready to enter</h2>
            <p className="mt-3 text-sm">
              {ready.length} sale{ready.length === 1 ? '' : 's'} ·{' '}
              {
                new Set(
                  ready.filter((line) => line.pdf).map((line) => line.invoice)
                ).size
              }{' '}
              invoice PDFs
            </p>
            {runLimit && (
              <p className="mt-2 rounded-md bg-warning/30 p-2 text-sm">
                Developer trial: this run is limited to the first {runLimit}{' '}
                sales. Relaunch without the limit before entering the rest.
              </p>
            )}
            <Button
              className="mt-5"
              disabled={!ready.length}
              onClick={() => void call(() => window.api.startRun())}
            >
              Start entering
            </Button>
            {!ready.length && (
              <p className="mt-2 text-sm text-muted-foreground">
                No sales are ready to enter.
              </p>
            )}
          </>
        )}
        {!summary && state.check && (
          <div
            className={`mt-5 rounded-lg p-3 text-sm ${state.check.ok ? 'bg-muted' : 'bg-warning/30'}`}
          >
            <strong>
              {state.check.ok
                ? 'Page check passed'
                : 'Page check needs attention'}
            </strong>
            <p>
              {state.check.program ?? 'Program unknown'} ·{' '}
              {state.check.dates[0] ?? '?'} to {state.check.dates[1] ?? '?'}
            </p>
            {state.check.problems.map((problem) => (
              <p key={problem} className="mt-2">
                {problem}
              </p>
            ))}
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-destructive/10 p-3 text-sm"
          >
            {error}
          </p>
        )}
        {!summary && (
          <>
            <ol
              aria-label="Claim activity"
              className="mt-5 min-h-0 flex-1 space-y-2 overflow-auto text-sm"
            >
              {state.activity.map((item, index) => (
                <li
                  key={`${item.lineId}-${index}`}
                  className="rounded-md bg-muted p-2"
                >
                  {item.text}
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              Auto Spiffer never clicks Next or Submit. When it finishes, check
              the page and submit the claim yourself.
            </p>
          </>
        )}
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
      </section>
    </div>
  )
}
