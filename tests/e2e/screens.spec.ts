import { _electron as electron, expect, test } from '@playwright/test'
import { testUserData } from './test-user-data'

test('Check now in development shows a plain error toast', async () => {
  const { args, remove } = testUserData()
  const app = await electron.launch({ args })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'Check now' }).click()
    const toast = page.getByRole('alert')
    await expect(toast.locator('span')).toHaveText(
      'Install Auto Spiffer to check for updates'
    )
    await expect(toast).toHaveClass(/fixed/)
  } finally {
    await app.close()
    remove()
  }
})

test('automatic update preference does not check for updates in development', async () => {
  const { args, remove } = testUserData()
  const app = await electron.launch({ args })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.evaluate(() => {
      const state = window as typeof window & { updatePhases?: string[] }
      state.updatePhases = []
      window.api.on('updateStateChanged', (next) =>
        state.updatePhases?.push(next.phase)
      )
    })
    const toggle = page.getByRole('checkbox', {
      name: 'Install updates automatically'
    })
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    await expect
      .poll(() => page.evaluate(() => window.api.getUpdateState()))
      .toMatchObject({ automatic: false })
    await toggle.click()
    await expect(toggle).toBeChecked()
    await expect
      .poll(() => page.evaluate(() => window.api.getUpdateState()))
      .toMatchObject({ automatic: true, phase: 'idle' })
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { updatePhases?: string[] }).updatePhases
      )
    ).not.toContain('checking')
  } finally {
    await app.close()
    remove()
  }
})

test('screens navigate and appearance and window size survive a restart', async () => {
  const { args, remove } = testUserData()
  try {
    const app = await electron.launch({ args })
    try {
      const page = await app.firstWindow()
      await page.getByRole('button', { name: 'ProRewards' }).click()
      await expect(
        page.getByRole('heading', { name: 'ProRewards', exact: true })
      ).toBeVisible()
      await page.getByRole('button', { name: 'Settings' }).click()
      await expect(
        page.getByRole('heading', { name: 'Settings' })
      ).toBeVisible()
      for (const name of [
        'ProRewards sign-in',
        'Appearance',
        'Updates',
        'Logs'
      ]) {
        await expect(page.getByRole('heading', { name })).toBeVisible()
      }
      const cardHeight = async (name: string): Promise<number> => {
        const box = await page
          .locator('section')
          .filter({ has: page.getByRole('heading', { name, exact: true }) })
          .boundingBox()
        expect(box).not.toBeNull()
        return box!.height
      }
      expect(await cardHeight('Appearance')).toBeLessThan(
        await cardHeight('ProRewards sign-in')
      )
      expect(await cardHeight('Logs')).toBeLessThan(await cardHeight('Updates'))
      const cardBox = async (name: string) => {
        const box = await page
          .locator('section')
          .filter({ has: page.getByRole('heading', { name, exact: true }) })
          .boundingBox()
        expect(box).not.toBeNull()
        return box!
      }
      const appearance = await cardBox('Appearance')
      const logs = await cardBox('Logs')
      const signIn = await cardBox('ProRewards sign-in')
      const updates = await cardBox('Updates')
      expect(
        Math.abs(logs.y - (appearance.y + appearance.height + 20))
      ).toBeLessThan(2)
      expect(logs.x).toBe(appearance.x)
      expect(updates.x).toBe(signIn.x)
      await expect(
        page.getByRole('heading', { name: 'Saved matches' })
      ).toHaveCount(0)
      await page.getByRole('button', { name: /Saved matches/ }).click()
      await expect(
        page.getByRole('heading', { name: 'Saved matches', level: 1 })
      ).toBeVisible()
      await page.getByRole('button', { name: 'Settings' }).click()
      await page.getByRole('radio', { name: 'Dark' }).check()
      await expect(page.locator('html')).toHaveClass(/dark/)
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.setSize(1180, 740)
      )
      await expect
        .poll(() => page.evaluate(() => window.api.getSettings()))
        .toMatchObject({
          theme: 'dark',
          windowBounds: { width: 1180, height: 740 }
        })
    } finally {
      await app.close()
    }

    const restarted = await electron.launch({ args })
    try {
      const page = await restarted.firstWindow()
      await expect(page.locator('html')).toHaveClass(/dark/)
      const size = await restarted.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.getSize()
      )
      expect(size).toBeDefined()
      expect(Math.abs(size![0]! - 1180)).toBeLessThanOrEqual(2)
      expect(Math.abs(size![1]! - 740)).toBeLessThanOrEqual(2)
      await page.waitForTimeout(300)
      expect(await page.evaluate(() => window.api.getSettings())).toMatchObject(
        {
          theme: 'dark',
          windowBounds: { width: 1180, height: 740 }
        }
      )
    } finally {
      await restarted.close()
    }
  } finally {
    remove()
  }
})

test('Same as Windows follows appearance changes without a restart', async () => {
  const { args, remove } = testUserData()
  const app = await electron.launch({ args })
  try {
    const page = await app.firstWindow()
    expect(await page.evaluate(() => window.api.getSettings())).toMatchObject({
      theme: 'system'
    })
    await app.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'dark'
    })
    await expect(page.locator('html')).toHaveClass(/dark/)
    await app.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = 'light'
    })
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  } finally {
    await app.close()
    remove()
  }
})
