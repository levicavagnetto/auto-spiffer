import type { SiteLocation } from './driver'

const timeoutMessage =
  'The website did not finish signing in (wrong password, a code, or a CAPTCHA?). Finish signing in in the ProRewards tab.'

type Dependencies = {
  whereAmI(): Promise<SiteLocation>
  saved(): { email: string; password: string } | null
  fillAndClick(email: string, password: string): Promise<void>
  attention(message: string): void
  now(): number
  wait(ms: number): Promise<void>
}

export function createSignInController(deps: Dependencies): {
  maybeSignIn(): Promise<void>
  retry(): Promise<void>
} {
  let attempted = false
  let active = false
  const maybeSignIn = async (): Promise<void> => {
    const location = await deps.whereAmI()
    if (location !== 'login') {
      attempted = false
      return
    }
    if (attempted || active) return
    attempted = true
    const saved = deps.saved()
    if (!saved) {
      deps.attention(
        'Sign in in the ProRewards tab, then return to Match tires.'
      )
      return
    }
    active = true
    try {
      await deps.fillAndClick(saved.email, saved.password)
      const until = deps.now() + 20_000
      while (deps.now() < until) {
        if ((await deps.whereAmI()) !== 'login') return
        await deps.wait(Math.min(500, until - deps.now()))
      }
      deps.attention(timeoutMessage)
    } catch {
      deps.attention(
        'Could not sign in automatically. Finish signing in in the ProRewards tab.'
      )
    } finally {
      active = false
    }
  }
  return {
    maybeSignIn,
    async retry() {
      if (active) return
      attempted = false
      await maybeSignIn()
    }
  }
}
