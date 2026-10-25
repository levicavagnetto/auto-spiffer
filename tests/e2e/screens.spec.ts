import { _electron as electron, expect, test } from '@playwright/test'
import { testUserData } from './test-user-data'

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
