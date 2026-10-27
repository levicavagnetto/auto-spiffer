import { _electron as electron, expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { installSiteStub } from './site-stub'
import { testUserData } from './test-user-data'

test('enters ready sales, skips them on restart, and never clicks Next', async () => {
  const { args, folder, remove } = testUserData()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 9, 18), 900101, '225/55R17 NOK REMEDY WRG5', 2])
  sheet.addRow([new Date(2026, 9, 19), 900102, '225/55R17 NOK REMEDY WRG5', 1])
  const exportPath = join(folder, 'sales.xlsx')
  await workbook.xlsx.writeFile(exportPath)
  const pdfPath = join(folder, '900101.pdf')
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  document.addPage().drawText('Invoice # 900101', { x: 60, y: 700, font })
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
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect
      .poll(() => page.evaluate(() => window.api.isClaimPage()))
      .toBe(true)
    await installSiteStub(app)
    await page.getByRole('button', { name: 'Sales' }).click()
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    await expect
      .poll(async () =>
        Boolean(await page.evaluate(() => window.api.getSalesSnapshot()))
      )
      .toBe(true)
    await page.evaluate((path) => window.api.addInvoicePaths([path]), pdfPath)
    await page.getByRole('button', { name: 'Match tires' }).click()
    await expect(
      page.getByRole('button', { name: 'Enter 2 sales' })
    ).toBeEnabled()
    await page.getByRole('button', { name: 'Enter 2 sales' }).click()
    await page.getByRole('button', { name: 'Start entering' }).click()
    await expect(page.getByText('Finished entering')).toBeVisible()
    let state = await page.evaluate(() => window.api.getRunState())
    expect(state.summary?.added).toHaveLength(2)
    expect(state.summary?.uploaded).toEqual(['900101'])
    expect(state.summary?.missingPdfs).toEqual(['900102'])
    await page.getByRole('button', { name: 'Check page and run again' }).click()
    await expect(page.getByText('Finished entering')).toBeVisible()
    state = await page.evaluate(() => window.api.getRunState())
    expect(state.summary?.alreadyThere).toHaveLength(2)
    expect(state.summary?.added).toHaveLength(0)
    const site = await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      return view.webContents.executeJavaScript(
        `({ rows: window.__stub.rows.length, files: window.__stub.files, next: window.__stub.nextClicked, clicks: window.__stub.clicks })`
      )
    })
    expect(site.rows).toBe(2)
    expect(site.files).toEqual(['900101.pdf'])
    expect(site.next).toBe(false)
    expect(
      site.clicks.filter(
        (item: string) => item === 'DefaultContent_AddProductLinkButton'
      )
    ).toHaveLength(2)
  } finally {
    await app.close()
    remove()
  }
})

test('a duplicate and a rejected sale are reported without clicking Yes or Next', async () => {
  const { args, folder, remove } = testUserData()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 9, 18), 900201, '225/55R17 NOK REMEDY WRG5', 2])
  const exportPath = join(folder, 'sales.xlsx')
  await workbook.xlsx.writeFile(exportPath)
  const app = await electron.launch({
    args,
    env: {
      ...process.env,
      AUTO_SPIFFER_TEST_SITE_FILE: resolve('tests/fixtures/claim-page.html')
    }
  })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect
      .poll(() => page.evaluate(() => window.api.isClaimPage()))
      .toBe(true)
    await installSiteStub(app)
    const mode = (value: string) =>
      app.evaluate(async ({ BrowserWindow }, next) => {
        const view = BrowserWindow.getAllWindows()[0]!.contentView
          .children[0] as Electron.WebContentsView
        await view.webContents.executeJavaScript(
          `window.__stub.mode = ${JSON.stringify(next)}`
        )
      }, value)
    await page.getByRole('button', { name: 'Sales' }).click()
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    await page.getByRole('button', { name: 'Match tires' }).click()
    await page.getByRole('button', { name: 'Enter 1 sale' }).click()
    await mode('duplicate')
    await page.getByRole('button', { name: 'Start entering' }).click()
    await expect
      .poll(
        async () => (await page.evaluate(() => window.api.getRunState())).phase
      )
      .toBe('finished')
    let state = await page.evaluate(() => window.api.getRunState())
    expect(state.summary?.failed[0]?.reason).toContain(
      'website says it is already entered'
    )
    await mode('rejected')
    await page.getByRole('button', { name: 'Check page and run again' }).click()
    await expect
      .poll(
        async () => (await page.evaluate(() => window.api.getRunState())).phase
      )
      .toBe('finished')
    state = await page.evaluate(() => window.api.getRunState())
    expect(state.summary?.failed[0]?.reason).toContain('rejected')
    const site = await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      return view.webContents.executeJavaScript(
        `({ rows: window.__stub.rows.length, next: window.__stub.nextClicked, no: window.__stub.noClicked, clicks: window.__stub.clicks })`
      )
    })
    expect(site.rows).toBe(0)
    expect(site.no).toBe(true)
    expect(site.next).toBe(false)
    expect(site.clicks).not.toContain('DefaultContent_YesLinkButton')
  } finally {
    await app.close()
    remove()
  }
})

test('Stop finishes the current sale and restart skips it', async () => {
  const { args, folder, remove } = testUserData()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 9, 18), 900301, '225/55R17 NOK REMEDY WRG5', 2])
  sheet.addRow([new Date(2026, 9, 19), 900302, '225/55R17 NOK REMEDY WRG5', 1])
  const exportPath = join(folder, 'sales.xlsx')
  await workbook.xlsx.writeFile(exportPath)
  const app = await electron.launch({
    args,
    env: {
      ...process.env,
      AUTO_SPIFFER_TEST_SITE_FILE: resolve('tests/fixtures/claim-page.html')
    }
  })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect
      .poll(() => page.evaluate(() => window.api.isClaimPage()))
      .toBe(true)
    await installSiteStub(app)
    await page.getByRole('button', { name: 'Sales' }).click()
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    await page.getByRole('button', { name: 'Match tires' }).click()
    await page.getByRole('button', { name: 'Enter 2 sales' }).click()
    await app.evaluate(() => {
      const scope = globalThis as typeof globalThis & {
        __siteDriver: { addLine: (...args: unknown[]) => Promise<unknown> }
        __releaseLine?: () => void
        __lineStarted?: boolean
      }
      const original = scope.__siteDriver.addLine.bind(scope.__siteDriver)
      scope.__siteDriver.addLine = async (...values) => {
        if (!scope.__lineStarted) {
          scope.__lineStarted = true
          await new Promise<void>((resolve) => {
            scope.__releaseLine = resolve
          })
        }
        return original(...values)
      }
    })
    await page.getByRole('button', { name: 'Start entering' }).click()
    await expect
      .poll(() =>
        app.evaluate(() =>
          Boolean((globalThis as { __lineStarted?: boolean }).__lineStarted)
        )
      )
      .toBe(true)
    await page.getByRole('button', { name: 'Stop', exact: true }).click()
    await app.evaluate(() =>
      (globalThis as { __releaseLine?: () => void }).__releaseLine?.()
    )
    await expect
      .poll(
        async () => (await page.evaluate(() => window.api.getRunState())).phase
      )
      .toBe('finished')
    let state = await page.evaluate(() => window.api.getRunState())
    expect(state.summary).toMatchObject({ stopped: true })
    expect(state.summary?.added).toHaveLength(1)
    await page.getByRole('button', { name: 'Check page and run again' }).click()
    await expect
      .poll(
        async () => (await page.evaluate(() => window.api.getRunState())).phase
      )
      .toBe('finished')
    state = await page.evaluate(() => window.api.getRunState())
    expect(state.summary?.alreadyThere).toHaveLength(1)
    expect(state.summary?.added).toHaveLength(1)
  } finally {
    await app.close()
    remove()
  }
})

test('closing during a run asks and waits for the current sale', async () => {
  const { args, folder, remove } = testUserData()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 9, 18), 900401, '225/55R17 NOK REMEDY WRG5', 2])
  const exportPath = join(folder, 'sales.xlsx')
  await workbook.xlsx.writeFile(exportPath)
  const app = await electron.launch({
    args,
    env: {
      ...process.env,
      AUTO_SPIFFER_TEST_SITE_FILE: resolve('tests/fixtures/claim-page.html')
    }
  })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect
      .poll(() => page.evaluate(() => window.api.isClaimPage()))
      .toBe(true)
    await installSiteStub(app)
    await page.getByRole('button', { name: 'Sales' }).click()
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    await page.getByRole('button', { name: 'Match tires' }).click()
    await page.getByRole('button', { name: 'Enter 1 sale' }).click()
    await app.evaluate(({ dialog }) => {
      const scope = globalThis as typeof globalThis & {
        __siteDriver: { addLine: (...args: unknown[]) => Promise<unknown> }
        __releaseLine?: () => void
        __lineStarted?: boolean
        __closeAsked?: boolean
      }
      const original = scope.__siteDriver.addLine.bind(scope.__siteDriver)
      scope.__siteDriver.addLine = async (...values) => {
        scope.__lineStarted = true
        await new Promise<void>((resolve) => {
          scope.__releaseLine = resolve
        })
        return original(...values)
      }
      dialog.showMessageBox = async () => {
        scope.__closeAsked = true
        return { response: 1, checkboxChecked: false }
      }
    })
    await page.getByRole('button', { name: 'Start entering' }).click()
    await expect
      .poll(() =>
        app.evaluate(() =>
          Boolean((globalThis as { __lineStarted?: boolean }).__lineStarted)
        )
      )
      .toBe(true)
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.close()
    )
    await expect
      .poll(() =>
        app.evaluate(() =>
          Boolean((globalThis as { __closeAsked?: boolean }).__closeAsked)
        )
      )
      .toBe(true)
    expect(page.isClosed()).toBe(false)
    await app.evaluate(() =>
      (globalThis as { __releaseLine?: () => void }).__releaseLine?.()
    )
    await expect.poll(() => page.isClosed()).toBe(true)
  } finally {
    await app.close().catch(() => undefined)
    remove()
  }
})
