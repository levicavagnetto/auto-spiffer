import { _electron as electron, expect, test } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { testUserData } from './test-user-data'

const savedPage = resolve(
  'private-data/site-pages/ATD ProRewards - Submit Sales.htm'
)

for (const scenario of ['one', 'none', 'two'] as const) {
  test(`saved program page has ${scenario} matching choices`, async () => {
    test.skip(!existsSync(savedPage), 'Private saved program page unavailable')
    const { args, remove } = testUserData()
    const app = await electron.launch({
      args,
      env: { ...process.env, AUTO_SPIFFER_TEST_SITE_FILE: savedPage }
    })
    try {
      const page = await app.firstWindow()
      await page.getByRole('button', { name: 'ProRewards' }).click()
      await expect
        .poll(() => page.evaluate(() => window.api.getSiteLocation()))
        .toBe('program-choice')
      if (scenario === 'two') {
        await app.evaluate(async ({ BrowserWindow }) => {
          const view = BrowserWindow.getAllWindows()[0]!.contentView
            .children[0] as Electron.WebContentsView
          await view.webContents.executeJavaScript(`
            const select = document.querySelector('#DefaultContent_PromotionDropDownList');
            const extra = document.createElement('option');
            extra.value = '999';
            extra.textContent = 'October 2026 Second Program';
            select.append(extra);
          `)
        })
      }
      const month = scenario === 'none' ? '2026-09' : '2026-10'
      const outcome = await app.evaluate(async (_electron, value) => {
        const driver = (
          globalThis as {
            __siteDriver?: { chooseProgram(month: string): Promise<string> }
          }
        ).__siteDriver!
        return driver.chooseProgram(value)
      }, month)
      expect(outcome).toBe(
        scenario === 'one'
          ? 'selected'
          : scenario === 'none'
            ? 'missing'
            : 'ambiguous'
      )
      if (scenario === 'one') {
        const selected = await app.evaluate(async ({ BrowserWindow }) => {
          const view = BrowserWindow.getAllWindows()[0]!.contentView
            .children[0] as Electron.WebContentsView
          return view.webContents.executeJavaScript(
            "document.querySelector('#DefaultContent_PromotionDropDownList').selectedOptions[0].textContent"
          )
        })
        expect(selected).toContain('October 2026 Pro Rewards')
      }
    } finally {
      await app.close()
      remove()
    }
  })
}
