import { _electron as electron, expect, test } from '@playwright/test'
import { existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { installSiteStub } from './site-stub'
import { testUserData } from './test-user-data'

const savedPage = resolve(
  'private-data/site-pages/ATD ProRewards - Submit Claim.htm'
)

test('uploads a PDF through the in-process debugger', async () => {
  test.skip(!existsSync(savedPage), 'Private claim page is not available')
  const { args, folder, remove } = testUserData()
  const pdf = join(folder, 'made-up-invoice.pdf')
  writeFileSync(pdf, '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n')
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
    const result = await app.evaluate(async (_electron, path) => {
      const driver = (
        globalThis as {
          __siteDriver?: { upload: (pdfPath: string) => Promise<void> }
        }
      ).__siteDriver!
      await driver.upload(path)
      return true
    }, pdf)
    expect(result).toBe(true)
    const files = await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      return view.webContents.executeJavaScript('window.__stub.files')
    })
    expect(files).toContain('made-up-invoice.pdf')
  } finally {
    await app.close()
    remove()
  }
})
