import type { ProgramChoice, SiteLocation } from './driver'

type Dependencies = {
  whereAmI(): Promise<SiteLocation>
  claimPromotion(): Promise<string | null>
  openSubmitSale(): Promise<void>
  chooseProgram(month: string): Promise<ProgramChoice>
  clickProgramNext(): Promise<void>
  signIn(): Promise<boolean | void>
  attention(message: string): void
  now(): number
  wait(ms: number): Promise<void>
}

export function createClaimNavigator(deps: Dependencies): {
  open(
    month: string,
    cancelled?: () => boolean,
    unattended?: boolean
  ): Promise<void>
} {
  const monthLabel = (month: string): string =>
    new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(`${month}-01T00:00:00Z`))
  const correctClaim = async (month: string): Promise<boolean> =>
    (await deps.whereAmI()) === 'claim' &&
    (await deps.claimPromotion())
      ?.toLowerCase()
      .includes(monthLabel(month).toLowerCase()) === true
  const waitFor = async (
    condition: (location: SiteLocation) => boolean,
    timeoutMs: number,
    cancelled?: () => boolean
  ): Promise<boolean> => {
    const until = deps.now() + timeoutMs
    while (deps.now() < until) {
      if (cancelled?.()) throw new Error('Claim entry was stopped.')
      if (condition(await deps.whereAmI())) return true
      await deps.wait(Math.min(250, until - deps.now()))
    }
    return condition(await deps.whereAmI())
  }
  const handoff = async (
    message: string,
    month: string,
    cancelled?: () => boolean,
    unattended = false
  ): Promise<void> => {
    if (unattended) throw new Error(message)
    deps.attention(message)
    const until = deps.now() + 60_000
    while (deps.now() < until) {
      if (cancelled?.()) throw new Error('Claim entry was stopped.')
      if (await correctClaim(month)) return
      await deps.wait(Math.min(2_000, until - deps.now()))
    }
    throw new Error(
      `${message} Try again after opening the correct claim page.`
    )
  }
  return {
    async open(month, cancelled, unattended = false) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        throw new Error('Choose a month of sales first.')
      if (cancelled?.()) throw new Error('Claim entry was stopped.')
      let location = await deps.whereAmI()
      if (location === 'claim' && (await correctClaim(month))) return
      if (location === 'other' || location === 'claim') {
        try {
          await deps.openSubmitSale()
        } catch {
          await handoff(
            'Could not open Submit Sale. Open the claim page in the ProRewards tab.',
            month,
            cancelled,
            unattended
          )
          return
        }
        await waitFor((value) => value !== 'other', 15_000, cancelled)
        location = await deps.whereAmI()
      }
      if (location === 'login') {
        const signInDeadline = deps.now() + 10_000
        const signedIn = await deps.signIn()
        if (signedIn === false) {
          await handoff(
            'Could not log in. Open ProRewards and sign in, then try Match tires again.',
            month,
            cancelled,
            unattended
          )
          return
        }
        await waitFor(
          (value) => value !== 'login',
          Math.max(0, signInDeadline - deps.now()),
          cancelled
        )
        location = await deps.whereAmI()
        if (location === 'login' && unattended)
          throw new Error(
            'Could not log in. Open ProRewards and sign in, then try Match tires again.'
          )
        if (location === 'other') {
          await deps.openSubmitSale()
          location = await deps.whereAmI()
        }
      }
      if (location === 'claim' && (await correctClaim(month))) return
      if (location !== 'program-choice') {
        await handoff(
          'Open the claim page in the ProRewards tab. Auto Spiffer will continue when it appears.',
          month,
          cancelled,
          unattended
        )
        return
      }
      const chosen = await deps.chooseProgram(month)
      if (chosen !== 'selected') {
        const message =
          chosen === 'missing'
            ? "This month's program is not in the list on the website. Pick the program in the ProRewards tab."
            : chosen === 'ambiguous'
              ? 'More than one program matches this month. Pick the program in the ProRewards tab.'
              : 'Could not choose the program. Pick it in the ProRewards tab.'
        await handoff(message, month, cancelled, unattended)
        return
      }
      if ((await deps.whereAmI()) !== 'program-choice') {
        await handoff(
          'The website changed while choosing the program. Open the claim page in the ProRewards tab.',
          month,
          cancelled,
          unattended
        )
        return
      }
      try {
        await deps.clickProgramNext()
      } catch {
        await handoff(
          'Could not open the claim page. Finish on the ProRewards tab.',
          month,
          cancelled,
          unattended
        )
        return
      }
      if (await waitFor((value) => value === 'claim', 15_000, cancelled)) {
        if (await correctClaim(month)) return
      }
      await handoff(
        'The claim page did not open. Finish on the ProRewards tab.',
        month,
        cancelled,
        unattended
      )
    }
  }
}
