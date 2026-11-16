import { useEffect, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
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
    <Card className="flex h-[calc(100vh-124px)] min-h-[500px] flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4 text-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Reload website"
          title="Reload website"
          onClick={() => void window.api.reloadSite()}
        >
          <RotateCw className="size-4" aria-hidden="true" />
        </Button>
        <span
          title={status.address}
          className="min-w-0 flex-1 truncate text-muted-foreground"
        >
          {status.address}
        </span>
        <Badge className="px-2.5">
          {status.state === 'loading'
            ? 'Loading'
            : status.state === 'error'
              ? 'Could not load'
              : status.state === 'ready'
                ? 'Page ready'
                : 'Opening'}
        </Badge>
        {siteLocation === 'login' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={retrying}
            onClick={() => {
              setRetrying(true)
              void window.api.retrySignIn().finally(() => setRetrying(false))
            }}
          >
            Try saved sign-in
          </Button>
        )}
      </div>
      {liveCheckAvailable && <LiveCheck />}
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
  )
}
