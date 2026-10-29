import {
  BookmarkCheck,
  FileSpreadsheet,
  Globe2,
  ListChecks,
  Send,
  Settings2
} from 'lucide-react'
import logo from '../assets/logo.svg'
import type { SiteLocation } from '../../../shared/ipc'
import type { UpdateState } from '../../../shared/updates'

export type Screen =
  'sales' | 'review' | 'enter' | 'website' | 'savedMatches' | 'settings'

const navItems = [
  {
    screen: 'sales',
    label: 'Sales',
    icon: FileSpreadsheet,
    group: 'Monthly claim'
  },
  {
    screen: 'review',
    label: 'Review',
    icon: ListChecks,
    group: 'Monthly claim'
  },
  {
    screen: 'enter',
    label: 'Enter claims',
    icon: Send,
    group: 'Monthly claim'
  },
  { screen: 'website', label: 'ProRewards', icon: Globe2, group: 'Website' },
  {
    screen: 'savedMatches',
    label: 'Saved matches',
    icon: BookmarkCheck,
    group: 'Other'
  },
  { screen: 'settings', label: 'Settings', icon: Settings2, group: 'Other' }
] as const

export function Sidebar({
  current,
  onNavigate,
  version,
  month,
  tireLines,
  reviewEnabled = false,
  enterEnabled = false,
  savedMatchCount,
  siteLocation,
  update,
  onRestartToUpdate
}: {
  current: Screen
  onNavigate: (screen: Screen) => void
  version: string
  month?: string
  tireLines?: number
  reviewEnabled?: boolean
  enterEnabled?: boolean
  savedMatchCount?: number
  siteLocation?: SiteLocation | null
  update?: UpdateState | null
  onRestartToUpdate?: () => void
}): React.JSX.Element {
  const monthName = month
    ? new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(new Date(`${month}-01T00:00:00Z`))
    : null
  return (
    <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col self-start overflow-y-auto border-r border-border bg-sidebar px-3 py-4">
      <div className="flex items-center gap-2 px-2 pb-6">
        <img src={logo} alt="" className="size-7" />
        <strong className="text-[15px] font-semibold">Auto Spiffer</strong>
      </div>
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          This month
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {monthName ?? 'No sales loaded'}
        </div>
        {monthName && (
          <div className="mt-1 text-xs text-muted-foreground">
            {tireLines ?? 0} tire line{tireLines === 1 ? '' : 's'}
          </div>
        )}
      </div>
      <nav aria-label="Main navigation" className="mt-5 flex flex-col gap-1">
        {navItems.map((item, index) => {
          const disabled =
            (item.screen === 'review' && !reviewEnabled) ||
            (item.screen === 'enter' && !enterEnabled)
          const reason =
            item.screen === 'review'
              ? "Load the month's sales first"
              : 'Review the sales first'
          const Icon = item.icon
          const showGroup =
            index === 0 || navItems[index - 1]?.group !== item.group
          return (
            <div key={item.screen}>
              {showGroup && (
                <div className="px-3 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.group}
                </div>
              )}
              <span title={disabled ? reason : undefined} className="block">
                <button
                  type="button"
                  disabled={disabled}
                  aria-current={current === item.screen ? 'page' : undefined}
                  onClick={() => onNavigate(item.screen)}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 aria-[current=page]:bg-muted"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {item.label}
                  {item.screen === 'savedMatches' &&
                    savedMatchCount !== undefined && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {savedMatchCount}
                      </span>
                    )}
                </button>
              </span>
              {item.screen === 'website' && (
                <div className="px-3 text-xs text-muted-foreground">
                  {siteLocation === 'claim' ||
                  siteLocation === 'program-choice' ||
                  siteLocation === 'other'
                    ? 'Signed in'
                    : 'Signed out'}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className="mt-auto px-3 pt-4 text-xs text-muted-foreground">
        {update?.phase === 'ready' && update.readyVersion ? (
          <>
            <p>Version {update.readyVersion} is ready</p>
            <button
              type="button"
              onClick={onRestartToUpdate}
              className="mt-1 text-accent hover:underline"
            >
              Restart to update
            </button>
          </>
        ) : (
          <p>
            Version {version}
            {update?.phase === 'up-to-date' ? ' · up to date' : ''}
          </p>
        )}
      </div>
    </aside>
  )
}
