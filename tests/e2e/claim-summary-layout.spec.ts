import { _electron as electron, expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { join, resolve } from 'node:path'
import type { RunState } from '../../src/shared/run'
import { testUserData } from './test-user-data'

test('a long completed summary stays inside the Enter pane at the minimum window size', async () => {
  const { args, folder, remove } = testUserData()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 9, 18), 900601, '225/55R17 NOK REMEDY WRG5', 1])
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
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]!.setSize(1100, 700)
    )
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect
      .poll(() => page.evaluate(() => window.api.isClaimPage()))
      .toBe(true)
    await page.getByRole('button', { name: 'Sales' }).click()
    await page
      .getByLabel('Choose Material Sales export')
      .setInputFiles(exportPath)
    await page.getByRole('button', { name: 'Match tires' }).click()
    await page.getByRole('button', { name: 'Enter 1 sale' }).click()
    const state: RunState = {
      phase: 'finished',
      check: null,
      done: 20,
      total: 20,
      now: null,
      activity: [],
      summary: {
        added: [],
        alreadyThere: [],
        failed: [],
        uploaded: [],
        uploadFailed: [],
        missingPdfs: Array.from({ length: 20 }, (_, index) =>
          String(900700 + index)
        ),
        stopped: false
      }
    }
    await app.evaluate(
      ({ BrowserWindow }, runState) =>
        BrowserWindow.getAllWindows()[0]!.webContents.send(
          'app:event:runStateChanged',
          runState
        ),
      state
    )
    await expect(
      page.getByRole('button', { name: /PDFs needing upload.*20 invoices/ })
    ).toBeVisible()
    const panel = page.getByRole('region', { name: 'Enter claims panel' })
    const details = page.getByRole('region', { name: 'PDF invoice list' })
    const button = page.getByRole('button', {
      name: 'Check page and run again'
    })
    const reminder = page.getByText(
      /Check the page, then click Next and Submit/
    )
    const [panelBox, detailsBox, buttonBox, reminderBox, websiteBox] =
      await Promise.all([
        panel.boundingBox(),
        details.boundingBox(),
        button.boundingBox(),
        reminder.boundingBox(),
        page.getByLabel('ProRewards website').boundingBox()
      ])
    expect(
      panelBox && detailsBox && buttonBox && reminderBox && websiteBox
    ).toBeTruthy()
    expect(detailsBox!.y + detailsBox!.height).toBeLessThanOrEqual(
      panelBox!.y + panelBox!.height
    )
    expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(
      panelBox!.y + panelBox!.height
    )
    expect(reminderBox!.y + reminderBox!.height).toBeLessThanOrEqual(
      panelBox!.y + panelBox!.height
    )
    expect(panelBox!.x + panelBox!.width).toBeLessThan(websiteBox!.x)
    expect(
      await details.evaluate(
        (element) => element.scrollHeight > element.clientHeight
      )
    ).toBe(true)
    await details.scrollIntoViewIfNeeded()
    await details.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect(
      page.getByRole('button', { name: 'Copy invoice 900719' })
    ).toBeInViewport()
    await expect(button).toBeInViewport()
  } finally {
    await app.close()
    remove()
  }
})
