import { _electron as electron, expect, test } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { installSiteStub } from './site-stub'
import { testUserData } from './test-user-data'

const savedPage = resolve(
  'private-data/site-pages/ATD ProRewards - Submit Claim.htm'
)
const product = 'Nokian Remedy WRG5 - Passenger Tires'

test('site driver reports each Add outcome and works while minimized', async () => {
  test.skip(!existsSync(savedPage), 'Private claim page is not available')
  const { args, remove } = testUserData()
  const app = await electron.launch({
    args,
    env: { ...process.env, AUTO_SPIFFER_TEST_SITE_FILE: savedPage }
  })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect
      .poll(() => page.evaluate(() => window.api.isClaimPage()))
      .toBe(true)
    await installSiteStub(app)
    const add = (invoice: string, label = product) =>
      app.evaluate(
        async (_electron, values) => {
          const driver = (
            globalThis as {
              __siteDriver?: {
                addLine: (line: {
                  saleDate: Date
                  invoice: string
                  product: string
                  qty: number
                }) => Promise<{ kind: string; message?: string }>
              }
            }
          ).__siteDriver!
          return driver.addLine({
            saleDate: new Date('2026-10-18T00:00:00.000Z'),
            invoice: values.invoice,
            product: values.label,
            qty: 4
          })
        },
        { invoice, label }
      )
    const mode = (value: string) =>
      app.evaluate(async ({ BrowserWindow }, nextMode) => {
        const view = BrowserWindow.getAllWindows()[0]!.contentView
          .children[0] as Electron.WebContentsView
        await view.webContents.executeJavaScript(
          `window.__stub.mode = ${JSON.stringify(nextMode)}`
        )
      }, value)
    await test.step('added', async () => {
      expect((await add('TEST-900101')).kind).toBe('added')
    })
    await test.step('an existing sale is left alone', async () => {
      const before = await app.evaluate(async ({ BrowserWindow }) => {
        const view = BrowserWindow.getAllWindows()[0]!.contentView
          .children[0] as Electron.WebContentsView
        return view.webContents.executeJavaScript(
          `window.__stub.clicks.filter(x => x === 'DefaultContent_AddProductLinkButton').length`
        )
      })
      expect((await add('TEST-900101')).kind).toBe('duplicate')
      const after = await app.evaluate(async ({ BrowserWindow }) => {
        const view = BrowserWindow.getAllWindows()[0]!.contentView
          .children[0] as Electron.WebContentsView
        return view.webContents.executeJavaScript(
          `window.__stub.clicks.filter(x => x === 'DefaultContent_AddProductLinkButton').length`
        )
      })
      expect(after).toBe(before)
    })
    await test.step('duplicate warning is answered No', async () => {
      await mode('duplicate')
      expect((await add('TEST-900102')).kind).toBe('duplicate')
      const status = await app.evaluate(async ({ BrowserWindow }) => {
        const view = BrowserWindow.getAllWindows()[0]!.contentView
          .children[0] as Electron.WebContentsView
        return view.webContents.executeJavaScript(`({
          no: window.__stub.noClicked,
          yes: window.__stub.clicks.includes('DefaultContent_YesLinkButton'),
          open: !document.querySelector('#DefaultContent_DuplicateLineItemMessagePopupPanel').hidden
        })`)
      })
      expect(status).toEqual({ no: true, yes: false, open: false })
    })
    await test.step('rejected message is read and dismissed', async () => {
      await mode('rejected')
      const result = await add('TEST-900103')
      expect(result.kind).toBe('rejected')
      expect(result.message).toContain('rejected')
      const popup = await app.evaluate(async ({ BrowserWindow }) => {
        const view = BrowserWindow.getAllWindows()[0]!.contentView
          .children[0] as Electron.WebContentsView
        return view.webContents.executeJavaScript(`(() => {
          const p = document.querySelector('#DefaultContent_ValidationPopupPanel');
          return { hidden: p.hidden, display: getComputedStyle(p).display,
            buttons: Array.from(p.querySelectorAll('button')).map(b => b.textContent.trim()),
            clicks: window.__stub.clicks.slice(-3) };
        })()`)
      })
      expect(popup.hidden).toBe(true)
    })
    await test.step('different quantity is a mismatch', async () => {
      await mode('mismatch')
      expect((await add('TEST-900104')).kind).toBe('mismatch')
    })
    await test.step('missing tire causes no Add click', async () => {
      await mode('normal')
      const before = await app.evaluate(async ({ BrowserWindow }) => {
        const view = BrowserWindow.getAllWindows()[0]!.contentView
          .children[0] as Electron.WebContentsView
        return view.webContents.executeJavaScript(
          `window.__stub.clicks.filter(x => x === 'DefaultContent_AddProductLinkButton').length`
        )
      })
      expect((await add('TEST-900105', 'A tire that is not listed')).kind).toBe(
        'rejected'
      )
      const after = await app.evaluate(async ({ BrowserWindow }) => {
        const view = BrowserWindow.getAllWindows()[0]!.contentView
          .children[0] as Electron.WebContentsView
        return view.webContents.executeJavaScript(
          `window.__stub.clicks.filter(x => x === 'DefaultContent_AddProductLinkButton').length`
        )
      })
      expect(after).toBe(before)
    })
    await test.step('minimized window still adds a line', async () => {
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]!.minimize()
      )
      expect((await add('TEST-900106')).kind).toBe('added')
    })
  } finally {
    await app.close()
    remove()
  }
})
