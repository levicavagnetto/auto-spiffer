import { useEffect, useState } from 'react'
import type { Theme } from '../../shared/ipc'
import { Sidebar, type Screen } from './components/Sidebar'
import { Sales } from './screens/Sales'
import { Review } from './screens/Review'
import { EnterClaims } from './screens/EnterClaims'
import { ProRewards } from './screens/ProRewards'
import { Settings } from './screens/Settings'

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
  const [current, setCurrent] = useState<Screen>('sales')
  const [version, setVersion] = useState('1.0.0')
  const [theme, setTheme] = useState<Theme>('system')
  const [settingsReady, setSettingsReady] = useState(false)
  const [systemDark, setSystemDark] = useState(false)

  useEffect(() => window.api.on('appError', setError), [])
  useEffect(() => window.api.on('themeChanged', setSystemDark), [])
  useEffect(() => {
    void window.api.getAppVersion().then(setVersion)
    void window.api.getSettings().then((settings) => {
      setTheme(settings.theme)
      setSettingsReady(true)
    })
    void window.api.getSystemTheme().then(setSystemDark)
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle(
      'dark',
      theme === 'dark' || (theme === 'system' && systemDark)
    )
  }, [theme, systemDark])

  const changeTheme = (choice: Theme): void => {
    const previous = theme
    setTheme(choice)
    void window.api.setTheme(choice).catch(() => {
      setTheme(previous)
      setError('Could not save your appearance choice. Try again.')
    })
  }

  const content =
    current === 'sales' ? (
      <Sales />
    ) : current === 'review' ? (
      <Review />
    ) : current === 'enter' ? (
      <EnterClaims />
    ) : current === 'website' ? (
      <ProRewards />
    ) : (
      <Settings
        theme={theme}
        onThemeChange={changeTheme}
        ready={settingsReady}
        savedMatchesOnly={current === 'savedMatches'}
      />
    )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar current={current} onNavigate={setCurrent} version={version} />
      <main className="min-w-0 flex-1">
        <header className="flex h-[60px] items-center border-b border-border px-8">
          <div>
            {steps[current] && (
              <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                {steps[current]}
              </div>
            )}
            <h1 className="text-lg font-semibold">{titles[current]}</h1>
          </div>
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
