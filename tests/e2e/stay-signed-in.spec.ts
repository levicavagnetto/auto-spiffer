import { _electron as electron, expect, test } from '@playwright/test'
import { testUserData } from './test-user-data'

for (const staySignedIn of [true, false])
  test(`site cookie ${staySignedIn ? 'survives' : 'is cleared after'} restart when Stay signed in is ${staySignedIn ? 'on' : 'off'}`, async () => {
    const { args, remove } = testUserData()
    const app = await electron.launch({ args })
    try {
      const page = await app.firstWindow()
      await app.evaluate(async ({ session }) => {
        await session.fromPartition('persist:prorewards').cookies.set({
          url: 'https://prorewards.acbrewards.com/',
          name: 'test-session',
          value: 'keep-me',
          expirationDate: Math.floor(Date.now() / 1000) + 86_400
        })
      })
      const before = await app.evaluate(({ session }) =>
        session
          .fromPartition('persist:prorewards')
          .cookies.get({ name: 'test-session' })
      )
      expect(before).toHaveLength(1)
      await page.getByRole('button', { name: 'Settings' }).click()
      if (!staySignedIn)
        await page.getByRole('checkbox', { name: 'Stay signed in' }).click()
      await expect
        .poll(() => page.evaluate(() => window.api.getCredentials()))
        .toMatchObject({ staySignedIn })
    } finally {
      await app.close()
    }
    const restarted = await electron.launch({ args })
    try {
      const cookies = await restarted.evaluate(({ session }) =>
        session
          .fromPartition('persist:prorewards')
          .cookies.get({ name: 'test-session' })
      )
      expect(cookies).toHaveLength(staySignedIn ? 1 : 0)
    } finally {
      await restarted.close()
      remove()
    }
  })
