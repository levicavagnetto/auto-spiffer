import type { ProgramChoice, SiteLocation } from './driver'

type Dependencies = {
  whereAmI(): Promise<SiteLocation>
  openSubmitSale(): Promise<void>
  chooseProgram(month: string): Promise<ProgramChoice>
  clickProgramNext(): Promise<void>
  signIn(): Promise<void>
  attention(message: string): void
  now(): number
  wait(ms: number): Promise<void>
}

export function createClaimNavigator(deps: Dependencies): {
  open(month: string): Promise<void>
} {
  const waitFor = async (
    condition: (location: SiteLocation) => boolean,
    timeoutMs: number
  ): Promise<boolean> => {
    const until = deps.now() + timeoutMs
    while (deps.now() < until) {
      if (condition(await deps.whereAmI())) return true
      await deps.wait(Math.min(250, until - deps.now()))
    }
    return condition(await deps.whereAmI())
  }
  const handoff = async (message: string): Promise<void> => {
    deps.attention(message)
    while ((await deps.whereAmI()) !== 'claim') await deps.wait(2_000)
  }
  return {
    async open(month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        throw new Error('Choose a month of sales first.')
      let location = await deps.whereAmI()
      if (location === 'claim') return
      if (location === 'other') {
        try {
          await deps.openSubmitSale()
        } catch {
          await handoff(
            'Could not open Submit Sale. Open the claim page in the ProRewards tab.'
          )
          return
        }
        await waitFor((value) => value !== 'other', 15_000)
        location = await deps.whereAmI()
      }
      if (location === 'login') {
        const signInDeadline = deps.now() + 20_000
        await deps.signIn()
        await waitFor(
          (value) => value !== 'login',
          Math.max(0, signInDeadline - deps.now())
        )
        location = await deps.whereAmI()
        if (location === 'other') {
          await deps.openSubmitSale()
          location = await deps.whereAmI()
        }
      }
      if (location === 'claim') return
      if (location !== 'program-choice') {
        await handoff(
          'Open the claim page in the ProRewards tab. Auto Spiffer will continue when it appears.'
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
        await handoff(message)
        return
      }
      if ((await deps.whereAmI()) !== 'program-choice') {
        await handoff(
          'The website changed while choosing the program. Open the claim page in the ProRewards tab.'
        )
        return
      }
      try {
        await deps.clickProgramNext()
      } catch {
        await handoff(
          'Could not open the claim page. Finish on the ProRewards tab.'
        )
        return
      }
      if (await waitFor((value) => value === 'claim', 15_000)) return
      await handoff(
        'The claim page did not open. Finish on the ProRewards tab.'
      )
    }
  }
}
