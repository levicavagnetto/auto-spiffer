import type { SiteLocation } from './driver'

const timeoutMessage =
  'The website did not finish signing in (wrong password, a code, or a CAPTCHA?). Finish signing in in the ProRewards tab.'
const rejectedMessage =
  'The website could not sign in with that password. Check it in Settings or sign in on ProRewards.'

type Dependencies = {
  whereAmI(): Promise<SiteLocation>
  loginError(): Promise<boolean>
  saved(): { email: string; password: string } | null
  fillAndClick(email: string, password: string): Promise<void>
  attention(message: string): void
  now(): number
  wait(ms: number): Promise<void>
}

export function createSignInController(deps: Dependencies): {
  maybeSignIn(): Promise<boolean>
  retry(): Promise<boolean>
  credentialsChanged(): Promise<boolean>
} {
  let attempted = false
  let generation = 0
  let active: Promise<boolean> | null = null
  const maybeSignIn = async (): Promise<boolean> => {
    const location = await deps.whereAmI()
    if (location !== 'login') {
      attempted = false
      return true
    }
    if (active) return active
    if (attempted) return false
    attempted = true
    const saved = deps.saved()
    if (!saved) {
      deps.attention(
        'Sign in in the ProRewards tab, then return to Match tires.'
      )
      return false
    }
    const attemptGeneration = generation
    const attempt = (async (): Promise<boolean> => {
      try {
        await deps.fillAndClick(saved.email, saved.password)
        const until = deps.now() + 10_000
        while (deps.now() < until) {
          if (generation !== attemptGeneration) return false
          if ((await deps.whereAmI()) !== 'login') return true
          if (await deps.loginError()) {
            deps.attention(rejectedMessage)
            return false
          }
          await deps.wait(Math.min(500, until - deps.now()))
        }
        if (generation !== attemptGeneration) return false
        deps.attention(timeoutMessage)
        return false
      } catch {
        if (generation === attemptGeneration)
          deps.attention(
            'Could not sign in automatically. Finish signing in in the ProRewards tab.'
          )
        return false
      }
    })()
    active = attempt
    try {
      return await attempt
    } finally {
      if (active === attempt) active = null
    }
  }
  const restart = async (): Promise<boolean> => {
    generation++
    if (active) await active
    attempted = false
    return maybeSignIn()
  }
  return {
    maybeSignIn,
    retry: restart,
    credentialsChanged: restart
  }
}
