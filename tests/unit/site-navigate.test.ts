import { expect, it, vi } from 'vitest'
import { createClaimNavigator } from '../../src/main/site/navigate'
import type { SiteLocation } from '../../src/main/site/driver'

function harness(
  initial: SiteLocation = 'program-choice',
  onWait?: (
    elapsed: number,
    ms: number,
    setLocation: (value: SiteLocation) => void
  ) => void
) {
  let location: SiteLocation = initial
  let elapsed = 0
  let promotion = 'October 2026 Pro Rewards'
  const openSubmitSale = vi.fn(async () => {
    location = 'program-choice'
  })
  const chooseProgram = vi.fn(async () => 'selected' as const)
  const clickProgramNext = vi.fn(async () => {
    location = 'claim'
    promotion = 'October 2026 Pro Rewards'
  })
  const attention = vi.fn()
  const navigator = createClaimNavigator({
    whereAmI: async () => location,
    claimPromotion: async () => promotion,
    openSubmitSale,
    chooseProgram,
    clickProgramNext,
    signIn: vi.fn(async () => undefined),
    attention,
    now: () => elapsed,
    wait: async (ms) => {
      elapsed += ms
      onWait?.(elapsed, ms, (value) => {
        location = value
      })
    }
  })
  return {
    navigator,
    openSubmitSale,
    chooseProgram,
    clickProgramNext,
    attention,
    setLocation(value: SiteLocation) {
      location = value
    },
    setPromotion(value: string) {
      promotion = value
    },
    elapsed: () => elapsed
  }
}

it('chooses the unique program and clicks only its step-one Next', async () => {
  const h = harness()
  await h.navigator.open('2026-10')
  expect(h.chooseProgram).toHaveBeenCalledExactlyOnceWith('2026-10')
  expect(h.clickProgramNext).toHaveBeenCalledOnce()
  expect(h.attention).not.toHaveBeenCalled()
})

it('fails immediately without switching tabs when unattended matching needs a person', async () => {
  const h = harness('program-choice')
  h.chooseProgram.mockResolvedValueOnce('missing' as never)
  await expect(h.navigator.open('2026-10', undefined, true)).rejects.toThrow(
    "This month's program is not in the list"
  )
  expect(h.attention).not.toHaveBeenCalled()
  expect(h.elapsed()).toBe(0)
})

it('opens Submit Sale when starting elsewhere and does not click when claim is already open', async () => {
  const fromHome = harness('other')
  await fromHome.navigator.open('2026-10')
  expect(fromHome.openSubmitSale).toHaveBeenCalledOnce()
  const onClaim = harness('claim')
  await onClaim.navigator.open('2026-10')
  expect(onClaim.openSubmitSale).not.toHaveBeenCalled()
  expect(onClaim.clickProgramNext).not.toHaveBeenCalled()
})

it('hands off a missing program and resumes when the person reaches the claim page', async () => {
  const h = harness('program-choice', (_elapsed, ms, setLocation) => {
    if (ms === 2_000) setLocation('claim')
  })
  h.chooseProgram.mockResolvedValueOnce('missing' as never)
  await h.navigator.open('2026-10')
  expect(h.clickProgramNext).not.toHaveBeenCalled()
  expect(h.attention).toHaveBeenCalledWith(
    "This month's program is not in the list on the website. Pick the program in the ProRewards tab."
  )
  expect(h.elapsed()).toBeGreaterThanOrEqual(2_000)
})

it('hands off when Next does not open the claim page within 15 seconds', async () => {
  const h = harness('program-choice', (elapsed, ms, setLocation) => {
    if (elapsed >= 17_000 && ms === 2_000) setLocation('claim')
  })
  h.clickProgramNext.mockImplementationOnce(async () => undefined)
  await h.navigator.open('2026-10')
  expect(h.attention).toHaveBeenCalledOnce()
  expect(h.elapsed()).toBeGreaterThanOrEqual(15_000)
})

it('does not add another 20-second wait after a failed 20-second sign-in', async () => {
  let elapsed = 0
  let location: SiteLocation = 'login'
  const attention = vi.fn()
  const navigator = createClaimNavigator({
    whereAmI: async () => location,
    claimPromotion: async () => 'October 2026 Pro Rewards',
    openSubmitSale: vi.fn(),
    chooseProgram: vi.fn(),
    clickProgramNext: vi.fn(),
    signIn: async () => {
      elapsed += 20_000
    },
    attention,
    now: () => elapsed,
    wait: async (ms) => {
      elapsed += ms
      if (ms === 2_000) location = 'claim'
    }
  })
  await navigator.open('2026-10')
  expect(elapsed).toBe(22_000)
  expect(attention).toHaveBeenCalledOnce()
})

it('leaves a wrong-month claim through Submit Sale before using the selected program', async () => {
  const h = harness('claim')
  h.setPromotion('September 2026 Pro Rewards')
  await h.navigator.open('2026-10')
  expect(h.openSubmitSale).toHaveBeenCalledOnce()
  expect(h.chooseProgram).toHaveBeenCalledExactlyOnceWith('2026-10')
  expect(h.clickProgramNext).toHaveBeenCalledOnce()
})

it('does not wait forever when the person cannot finish the program choice', async () => {
  const h = harness()
  h.chooseProgram.mockResolvedValueOnce('missing' as never)
  await expect(h.navigator.open('2026-10')).rejects.toThrow(
    /program|claim page/i
  )
  expect(h.elapsed()).toBeLessThanOrEqual(60_000)
  expect(h.clickProgramNext).not.toHaveBeenCalled()
})

it('cancels a manual navigation handoff before its deadline', async () => {
  const h = harness()
  h.chooseProgram.mockResolvedValueOnce('missing' as never)
  await expect(
    h.navigator.open('2026-10', () => h.elapsed() >= 2_000)
  ).rejects.toThrow('stopped')
  expect(h.elapsed()).toBe(2_000)
})
