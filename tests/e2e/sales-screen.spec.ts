import { _electron as electron, expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { testUserData } from './test-user-data'

test('Sales screen imports a workbook and PDF, then opens the claim page for matching', async () => {
  const { args, folder, remove } = testUserData()
  const exportPath = join(folder, 'sales.xlsx')
  const pdfPath = join(folder, 'invoice.pdf')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 9, 3), 900701, '235/50R18 GEN RT45', 2])
  sheet.addRow([
    new Date(2026, 9, 3),
    900702,
    '18X8.50/9.50-8 FST TR13 TUBE',
    1
  ])
  await workbook.xlsx.writeFile(exportPath)
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  document.addPage().drawText('Invoice # 900701', { x: 60, y: 700, font })
  writeFileSync(pdfPath, await document.save())

  const app = await electron.launch({
    args,
    env: {
      ...process.env,
      AUTO_SPIFFER_TEST_SITE_FILE: resolve('tests/fixtures/claim-page.html')
    }
  })
  try {
    const page = await app.firstWindow()
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.setSize(1100, 700)
    )
    await expect(page.getByText('No sales loaded yet.')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Match tires' })
    ).toBeDisabled()
    await expect(
      page.locator('main > header').getByRole('button', { name: 'Match tires' })
    ).toHaveCount(1)
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    await expect(page.getByText('October 2026', { exact: true })).toBeVisible()
    await expect(page.getByText('2 rows')).toBeVisible()
    await expect(
      page.getByRole('main').getByText('1 tire line', { exact: true })
    ).toBeVisible()
    await expect(page.getByText('1 tube')).toBeVisible()
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'ProRewards' })
    ).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: 'Ready to match' })
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'ProRewards' })).toBeEnabled()
    const exportCard = page.locator('main section').filter({
      has: page.getByRole('heading', { name: 'Material Sales export' })
    })
    const pdfCard = page.locator('main section').filter({
      has: page.getByRole('heading', { name: 'Invoice PDFs' })
    })
    const exportWidth = (await exportCard.boundingBox())?.width ?? 0
    const pdfWidth = (await pdfCard.boundingBox())?.width ?? 0
    expect(exportWidth).toBeGreaterThan(700)
    expect(pdfWidth).toBeGreaterThan(700)
    expect(Math.abs(exportWidth - pdfWidth)).toBeLessThan(2)
    await expect(page.getByText('1 invoice needs a PDF')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Copy invoice 900701' })
    ).toHaveCount(0)
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (value: string) => {
            ;(
              window as typeof window & { copiedInvoice?: string }
            ).copiedInvoice = value
            return Promise.resolve()
          }
        }
      })
    })
    await page.getByRole('button', { name: 'Show invoices' }).click()
    await page.getByRole('button', { name: 'Copy invoice 900701' }).click()
    await expect(page.getByRole('status')).toHaveText('Copied invoice 900701.')
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { copiedInvoice?: string }).copiedInvoice
      )
    ).toBe('900701')
    await expect(
      page.getByRole('button', { name: 'Copy all numbers' })
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Hide invoices' }).click()
    await expect(
      page.getByRole('button', { name: 'Copy invoice 900701' })
    ).toHaveCount(0)
    expect(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
    await page.getByLabel('Add invoice PDFs').setInputFiles(pdfPath)
    await expect(page.getByText('1 PDF loaded')).toBeVisible()
    await expect(page.getByText('1 linked to a sale')).toBeVisible()
    await expect(page.getByText('1 invoice needs a PDF')).toHaveCount(0)
    await page.getByRole('button', { name: 'Remove invoice.pdf' }).click()
    await expect(page.getByText('0 PDFs loaded')).toBeVisible()
    await page.evaluate(() => {
      const root = window as typeof window & {
        showedWebsiteDuringMatch?: boolean
      }
      root.showedWebsiteDuringMatch = false
      new MutationObserver(() => {
        if (
          globalThis.document.querySelector('main h1')?.textContent ===
          'ProRewards'
        )
          root.showedWebsiteDuringMatch = true
      }).observe(globalThis.document.querySelector('main')!, {
        childList: true,
        subtree: true
      })
    })
    await page.getByRole('button', { name: 'Match tires' }).click()
    await expect
      .poll(() => page.evaluate(() => window.api.getSiteStatus()))
      .toMatchObject({ state: 'ready' })
    await expect
      .poll(() => page.evaluate(() => window.api.getSiteLocation()))
      .toBe('claim')
    await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible()
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { showedWebsiteDuringMatch?: boolean })
            .showedWebsiteDuringMatch
      )
    ).toBe(false)
    await expect(
      page.getByRole('button', { name: 'Review', exact: true })
    ).toBeEnabled()
  } finally {
    await app.close()
    remove()
  }
})

test('Sales screen names a missing export column', async () => {
  const { args, folder, remove } = testUserData()
  const path = join(folder, 'missing-column.xlsx')
  const workbook = new ExcelJS.Workbook()
  workbook
    .addWorksheet('Report')
    .addRow(['Invoiced', 'Invoice #', 'Description'])
  await workbook.xlsx.writeFile(path)
  const app = await electron.launch({ args })
  try {
    const page = await app.firstWindow()
    await page.getByLabel('Choose Material Sales export').setInputFiles(path)
    await expect(page.getByRole('alert')).toHaveText(
      'This file does not look like a Material Sales export: the Quantity column is missing.'
    )
    await expect(
      page.getByRole('button', { name: 'Match tires' })
    ).toBeDisabled()
  } finally {
    await app.close()
    remove()
  }
})

test('Match tires keeps Sales open and shows a login error when sign-in is needed', async () => {
  const { args, folder, remove } = testUserData()
  const exportPath = join(folder, 'sales.xlsx')
  const loginPage = join(folder, 'login.html')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 9, 3), 900711, '235/50R18 GEN RT45', 2])
  await workbook.xlsx.writeFile(exportPath)
  writeFileSync(
    loginPage,
    '<html><body><input id="UserLogin_Password" type="password"></body></html>'
  )
  const app = await electron.launch({
    args,
    env: { ...process.env, AUTO_SPIFFER_TEST_SITE_FILE: loginPage }
  })
  try {
    const page = await app.firstWindow()
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    await page.getByRole('button', { name: 'Match tires' }).click()
    await expect(
      page.getByRole('heading', { name: 'Sales', level: 1 })
    ).toBeVisible()
    await expect(page.getByRole('alert').locator('span')).toHaveText('Could not log in')
    await expect(page.getByRole('heading', { name: 'Review' })).toHaveCount(0)
  } finally {
    await app.close()
    remove()
  }
})

test('a corrected saved password retries without restarting the app', async () => {
  const { args, folder, remove } = testUserData()
  const exportPath = join(folder, 'sales.xlsx')
  const loginPage = join(folder, 'login.html')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 9, 3), 900712, '235/50R18 GEN RT45', 2])
  await workbook.xlsx.writeFile(exportPath)
  writeFileSync(
    loginPage,
    `<html><body>
    <input id="UserLogin_UserName"><input id="UserLogin_Password" type="password">
    <a id="UserLogin_Login" href="javascript:void(0)" onclick="window.attempts=(window.attempts||0)+1;if(document.querySelector('#UserLogin_Password').value==='correct-password'){document.querySelector('#UserLogin_Password').remove()}else{document.querySelector('.errorLiteral').textContent='Invalid password'}">Login</a>
    <div class="errorLiteral"></div>
  </body></html>`
  )
  const app = await electron.launch({
    args,
    env: { ...process.env, AUTO_SPIFFER_TEST_SITE_FILE: loginPage }
  })
  try {
    const page = await app.firstWindow()
    await page.evaluate(() =>
      window.api.saveCredentials({
        email: 'shop@example.com',
        password: 'wrong-password'
      })
    )
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    await page.getByRole('button', { name: 'Match tires' }).click()
    await expect(page.getByRole('alert').locator('span')).toHaveText('Could not log in', {
      timeout: 5000
    })
    await page.evaluate(() =>
      window.api.saveCredentials({
        email: 'shop@example.com',
        password: 'correct-password'
      })
    )
    await expect
      .poll(() => page.evaluate(() => window.api.getSiteLocation()))
      .toBe('other')
    const attempts = await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      return view.webContents.executeJavaScript('window.attempts')
    })
    expect(attempts).toBe(2)
  } finally {
    await app.close()
    remove()
  }
})
