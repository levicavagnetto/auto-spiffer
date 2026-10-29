import { _electron as electron, expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { testUserData } from './test-user-data'

test('returns to the month claim before Start and rerun without adding an existing sale', async () => {
  const { args, folder, remove } = testUserData()
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Report')
  sheet.addRow(['Invoiced', 'Invoice #', 'Description', 'Quantity'])
  sheet.addRow([new Date(2026, 9, 18), 900701, '225/55R17 NOK REMEDY WRG5', 2])
  const exportPath = join(folder, 'sales.xlsx')
  await workbook.xlsx.writeFile(exportPath)
  const fixture = readFileSync(
    resolve('tests/fixtures/claim-page.html'),
    'utf8'
  )
  const existing =
    '<tbody><tr><td>Remove</td><td>10/18/2026</td><td>900701</td><td>Nokian Remedy WRG5 - Passenger Tires</td><td>2</td></tr></tbody>'
  const claimPath = join(folder, 'claim.html')
  writeFileSync(
    claimPath,
    fixture.replace(
      '<tbody><tr class="rgNoRecords"><td colspan="5">No records</td></tr></tbody>',
      existing
    )
  )
  const app = await electron.launch({
    args,
    env: { ...process.env, AUTO_SPIFFER_TEST_SITE_FILE: claimPath }
  })
  try {
    const page = await app.firstWindow()
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
    const leaveClaim = () =>
      app.evaluate(async ({ BrowserWindow }) => {
        const view = BrowserWindow.getAllWindows()[0]!.contentView
          .children[0] as Electron.WebContentsView
        await view.webContents.loadURL('about:blank')
      })
    await leaveClaim()
    await page.getByRole('button', { name: 'Start entering' }).click()
    await expect
      .poll(
        async () => (await page.evaluate(() => window.api.getRunState())).phase
      )
      .toBe('finished')
    let state = await page.evaluate(() => window.api.getRunState())
    expect(state.summary?.alreadyThere).toHaveLength(1)
    expect(state.summary?.added).toHaveLength(0)
    await leaveClaim()
    await page.getByRole('button', { name: 'Check page and run again' }).click()
    await expect
      .poll(
        async () => (await page.evaluate(() => window.api.getRunState())).phase
      )
      .toBe('finished')
    state = await page.evaluate(() => window.api.getRunState())
    expect(state.summary?.alreadyThere).toHaveLength(1)
    expect(state.summary?.added).toHaveLength(0)
    expect(await page.evaluate(() => window.api.isClaimPage())).toBe(true)
  } finally {
    await app.close()
    remove()
  }
})
