import { expect, it, vi } from 'vitest'
import { createSignInController } from '../../src/main/site/signin'

it('tries the saved password once and does not retry while login stays visible', async () => {
  let location: 'login' | 'other' = 'login'
  const fillAndClick = vi.fn(async () => undefined)
  const attention = vi.fn()
  const controller = createSignInController({
    whereAmI: async () => location,
    loginError: async () => false,
    saved: () => ({ email: 'shop@example.com', password: 'secret' }),
    fillAndClick,
    attention,
    now: () => 0,
    wait: async () => {
      location = 'other'
    }
  })
  await controller.maybeSignIn()
  expect(fillAndClick).toHaveBeenCalledExactlyOnceWith(
    'shop@example.com',
    'secret'
  )
  location = 'login'
  await controller.maybeSignIn()
  expect(fillAndClick).toHaveBeenCalledTimes(1)
  expect(attention).not.toHaveBeenCalled()
})

it('stops after 10 seconds on the login page and waits for an explicit retry', async () => {
  let elapsed = 0
  const fillAndClick = vi.fn(async () => undefined)
  const attention = vi.fn()
  const controller = createSignInController({
    whereAmI: async () => 'login',
    loginError: async () => false,
    saved: () => ({ email: 'shop@example.com', password: 'wrong' }),
    fillAndClick,
    attention,
    now: () => elapsed,
    wait: async (ms) => {
      elapsed += ms
    }
  })
  await controller.maybeSignIn()
  expect(elapsed).toBe(10_000)
  expect(attention).toHaveBeenCalledExactlyOnceWith(
    'The website did not finish signing in (wrong password, a code, or a CAPTCHA?). Finish signing in in the ProRewards tab.'
  )
  await controller.maybeSignIn()
  expect(fillAndClick).toHaveBeenCalledTimes(1)
  await controller.retry()
  expect(fillAndClick).toHaveBeenCalledTimes(2)
})

it('never uses the password while cookies keep the tab signed in', async () => {
  const fillAndClick = vi.fn()
  const controller = createSignInController({
    whereAmI: async () => 'other',
    loginError: async () => false,
    saved: () => ({ email: 'shop@example.com', password: 'secret' }),
    fillAndClick,
    attention: vi.fn(),
    now: () => 0,
    wait: async () => undefined
  })
  await controller.maybeSignIn()
  expect(fillAndClick).not.toHaveBeenCalled()
})

it('stops promptly when the site shows a login error and retries after credentials change', async () => {
  let password = 'wrong'
  let errorVisible = false
  let location: 'login' | 'other' = 'login'
  let elapsed = 0
  const fillAndClick = vi.fn(
    async (_email: string, attemptedPassword: string) => {
      if (attemptedPassword === 'wrong') errorVisible = true
      else location = 'other'
    }
  )
  const attention = vi.fn()
  const controller = createSignInController({
    whereAmI: async () => location,
    loginError: async () => errorVisible,
    saved: () => ({ email: 'shop@example.com', password }),
    fillAndClick,
    attention,
    now: () => elapsed,
    wait: async (ms) => {
      elapsed += ms
    }
  })
  expect(await controller.maybeSignIn()).toBe(false)
  expect(elapsed).toBeLessThan(10_000)
  password = 'correct'
  errorVisible = false
  expect(await controller.credentialsChanged()).toBe(true)
  expect(fillAndClick).toHaveBeenCalledTimes(2)
  expect(attention).toHaveBeenCalledTimes(1)
})
