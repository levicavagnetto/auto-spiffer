import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CredentialsState, SiteLocation, Theme } from '../../shared/ipc'
import { Sidebar, type Screen } from './components/Sidebar'
import { ErrorToast } from './components/ErrorToast'
import { Sales } from './screens/Sales'
import { Review } from './screens/Review'
import { EnterClaims } from './screens/EnterClaims'
import { ProRewards } from './screens/ProRewards'
import { Settings } from './screens/Settings'
import type { SalesSnapshot } from '../../shared/sales'
import type { ReviewSnapshot, SavedMatchList } from '../../shared/review'
import type { RunState } from '../../shared/run'
import type { UpdateState } from '../../shared/updates'

const titles: Record<Screen, string> = {
  sales: 'Sales',
  review: 'Review',
  enter: 'Enter claims',
  website: 'ProRewards',
  savedMatches: 'Saved matches',
  settings: 'Settings'
}

const steps: Partial<Record<Screen, string>> = {
  sales: 'Step 1',
  review: 'Step 2',
  enter: 'Step 3'
}

export default function App(): React.JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [matchError, setMatchError] = useState<string | null>(null)
  const matching = useRef(false)
  const [current, setCurrent] = useState<Screen>('sales')
  const [version, setVersion] = useState('1.1.0')
  const [theme, setTheme] = useState<Theme>('system')
  const [settingsReady, setSettingsReady] = useState(false)
  const [systemDark, setSystemDark] = useState(false)
  const [salesSnapshot, setSalesSnapshot] = useState<SalesSnapshot | null>(null)
  const [headerActions, setHeaderActions] = useState<HTMLDivElement | null>(
    null
  )
  const [reviewReady, setReviewReady] = useState(false)
  const [reviewSnapshot, setReviewSnapshot] = useState<ReviewSnapshot | null>(
    null
  )
  const [savedMatches, setSavedMatches] = useState<SavedMatchList>([])
  const [runState, setRunState] = useState<RunState | null>(null)
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  const [credentials, setCredentials] = useState<CredentialsState | null>(null)
  const [siteLocation, setSiteLocation] = useState<SiteLocation | null>(null)

  useEffect(() => window.api.on('appError', setError), [])
  useEffect(() => window.api.on('themeChanged', setSystemDark), [])
  useEffect(() => window.api.on('updateStateChanged', setUpdateState), [])
  useEffect(
    () =>
      window.api.on('signInAttention', (message) => {
        if (matching.current) return
        setError(message)
        setCurrent('website')
      }),
    []
  )
  useEffect(
    () =>
      window.api.on('siteNeedsAttention', (message) => {
        if (matching.current) return
        setError(message)
        setCurrent('website')
      }),
    []
  )
  useEffect(
    () =>
      window.api.on('siteStatusChanged', (status) => {
        if (status.state !== 'ready') return
        void window.api
          .getSiteLocation()
          .then(setSiteLocation)
          .catch(() => setSiteLocation(null))
      }),
    []
  )
  useEffect(
    () =>
      window.api.on('runStateChanged', (state) => {
        setRunState(state)
        if (state.phase === 'finished') setCurrent('enter')
      }),
    []
  )
  useEffect(() => {
    void window.api.getAppVersion().then(setVersion)
    void window.api.getUpdateState().then(setUpdateState)
    void window.api.getSettings().then((settings) => {
      setTheme(settings.theme)
      setSettingsReady(true)
    })
    void window.api.getSystemTheme().then(setSystemDark)
    void window.api.getSalesSnapshot().then(setSalesSnapshot)
    void window.api.getReviewSnapshot().then((next) => {
      setReviewSnapshot(next)
      setReviewReady(Boolean(next))
    })
    void window.api.listSavedMatches().then(setSavedMatches)
    void window.api.getRunState().then(setRunState)
    void window.api.getCredentials().then(setCredentials)
    void window.api.getSiteStatus().then((status) => {
      if (status.state === 'ready')
        void window.api.getSiteLocation().then(setSiteLocation)
    })
  }, [])
  useEffect(() => {
    void window.api.listSavedMatches().then(setSavedMatches)
  }, [reviewSnapshot])
  useEffect(() => {
    document.documentElement.classList.toggle(
      'dark',
      theme === 'dark' || (theme === 'system' && systemDark)
    )
  }, [theme, systemDark])
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [current])
  useEffect(() => {
    document.documentElement.classList.toggle(
      'hide-app-scrollbars',
      current === 'review' || current === 'enter'
    )
    return () =>
      document.documentElement.classList.remove('hide-app-scrollbars')
  }, [current])

  const changeTheme = (choice: Theme): void => {
    const previous = theme
    setTheme(choice)
    void window.api.setTheme(choice).catch(() => {
      setTheme(previous)
      setError('Could not save your appearance choice. Try again.')
    })
  }
  const restartToUpdate = (): void => {
    void window.api
      .restartToUpdate()
      .then(setUpdateState)
      .catch(() => {
        setError('Could not start the update. Try again from Settings.')
      })
  }

  const content =
    current === 'sales' ? (
      <Sales
        headerActions={headerActions}
        snapshot={salesSnapshot}
        onSnapshot={(next, newExport) => {
          setSalesSnapshot(next)
          if (newExport) {
            setReviewReady(false)
            setReviewSnapshot(null)
          }
        }}
        onMatch={async () => {
          matching.current = true
          setMatchError(null)
          try {
            const next = await window.api.matchTires()
            setReviewSnapshot(next)
            setReviewReady(true)
            setCurrent('review')
            setError(null)
          } catch (problem) {
            const detail = problem instanceof Error ? problem.message : ''
            setMatchError(
              detail.includes('Could not log in')
                ? 'Could not log in'
                : detail.replace(
                    /^Error occurred in handler for 'app:invoke': Error: /,
                    ''
                  ) || 'Could not match tires. Check ProRewards and try again.'
            )
          } finally {
            matching.current = false
          }
        }}
      />
    ) : current === 'review' ? (
      <Review
        headerActions={headerActions}
        snapshot={reviewSnapshot}
        run={runState}
        onSnapshot={setReviewSnapshot}
        onEnter={() => setCurrent('enter')}
      />
    ) : current === 'enter' ? (
      <EnterClaims review={reviewSnapshot} run={runState} />
    ) : current === 'website' ? (
      <ProRewards siteLocation={siteLocation} />
    ) : (
      <Settings
        theme={theme}
        onThemeChange={changeTheme}
        ready={settingsReady}
        credentials={credentials}
        onCredentials={setCredentials}
        update={updateState}
        onUpdate={setUpdateState}
        savedMatchesOnly={current === 'savedMatches'}
        savedMatches={savedMatches}
        onRemoveSaved={(signature) => {
          void window.api
            .removeSavedMatch(signature)
            .then(() => window.api.listSavedMatches())
            .then(setSavedMatches)
            .catch(() =>
              setError('Could not remove that saved match. Try again.')
            )
        }}
      />
    )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {matchError && (
        <ErrorToast
          message={matchError}
          onDismiss={() => setMatchError(null)}
        />
      )}
      <Sidebar
        current={current}
        onNavigate={setCurrent}
        version={version}
        month={salesSnapshot?.state.month}
        tireLines={
          salesSnapshot?.state.sales.filter((sale) => !sale.notATire).length
        }
        reviewEnabled={reviewReady}
        enterEnabled={
          Boolean(
            reviewSnapshot?.lines.some(
              (line) => line.status === 'ready' && !line.leftOut
            )
          ) &&
          !reviewSnapshot?.lines.some(
            (line) => line.status === 'needs-decision' && !line.leftOut
          )
        }
        savedMatchCount={savedMatches.length}
        siteLocation={siteLocation}
        update={updateState}
        onRestartToUpdate={restartToUpdate}
      />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-[60px] items-center justify-between gap-4 border-b border-border bg-header px-8">
          <div>
            {steps[current] && (
              <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                {steps[current]}
              </div>
            )}
            <h1 className="text-lg font-semibold">{titles[current]}</h1>
          </div>
          <div ref={setHeaderActions} className="flex items-center gap-3" />
        </header>
        <div className="p-8">
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-md bg-destructive p-3 text-sm text-destructive-foreground"
            >
              {error}
            </div>
          )}
          {content}
        </div>
      </main>
    </div>
  )
}
