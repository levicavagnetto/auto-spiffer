import { useEffect, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import type { SiteLocation, SiteStatus } from '../../../shared/ipc'
import { LiveCheck } from './LiveCheck'

export function ProRewards({
  siteLocation
}: {
  siteLocation?: SiteLocation | null
}): React.JSX.Element {
  const slot = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<SiteStatus>({
    address: 'https://prorewards.acbrewards.com/',
    state: 'notOpened'
  })
  const [retrying, setRetrying] = useState(false)
  const [liveCheckAvailable, setLiveCheckAvailable] = useState(false)

  useEffect(() => {
    const unsubscribe = window.api.on('siteStatusChanged', setStatus)
    void window.api.getSiteStatus().then(setStatus)
    void window.api.getLiveCheckAvailable().then(setLiveCheckAvailable)
    return unsubscribe
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

  return (
    <section className="flex h-[calc(100vh-124px)] min-h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4 text-sm">
        <button
          type="button"
          aria-label="Reload website"
          title="Reload website"
          onClick={() => void window.api.reloadSite()}
          className="rounded-md p-1.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-accent"
        >
          <RotateCw className="size-4" aria-hidden="true" />
        </button>
        <span
          title={status.address}
          className="min-w-0 flex-1 truncate text-muted-foreground"
        >
          {status.address}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          {status.state === 'loading'
            ? 'Loading'
            : status.state === 'error'
              ? 'Could not load'
              : status.state === 'ready'
                ? 'Page ready'
                : 'Opening'}
        </span>
        {siteLocation === 'login' && (
          <button
            type="button"
            disabled={retrying}
            onClick={() => {
              setRetrying(true)
              void window.api.retrySignIn().finally(() => setRetrying(false))
            }}
            className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
          >
            Try saved sign-in
          </button>
        )}
      </div>
      {liveCheckAvailable && <LiveCheck />}
      <div
        ref={slot}
        aria-label="ProRewards website"
        className="min-h-0 flex-1"
      />
    </section>
  )
}
