import { _electron as electron, expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { testUserData } from './test-user-data'

test('reads the program, tire labels and sale rows from the claim page', async () => {
  const { args, remove } = testUserData()
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
    const program = await page.evaluate(() => window.api.readSitePage())
    expect(program?.promotion).toBe('October 2026 Pro Rewards')
    expect(
      program?.window.map((date) => date?.toISOString().slice(0, 10))
    ).toEqual(['2026-10-01', '2026-10-31'])
    expect(program?.tires).toEqual([
      'ATD Custom Wheels',
      'Continental SecureContact AW - Passenger Tires',
      'Continental Terrain Contact H/T - Light Truck Tires',
      'Continental TrueContact Tour 54 - Passenger Tires',
      'Nokian Remedy WRG5 - Passenger Tires',
      'Nokian One - Passenger Tires'
    ])
    expect(program?.lines).toEqual([])
    await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      await view.webContents.executeJavaScript(`
        const body = document.querySelector('#ctl00_DefaultContent_ProductRadGrid_ctl00 tbody');
        body.innerHTML = '<tr><td>Delete</td><td>10/18/2026</td><td>900001</td><td>Nokian Remedy WRG5 - Passenger Tires</td><td>4</td></tr>' +
          '<tr><td>Delete</td><td>10/19/2026</td><td>900002</td><td>Nokian One - Passenger Tires</td><td>2</td></tr>';
      `)
    })
    const lines = (await page.evaluate(() => window.api.readSitePage()))?.lines
    expect(
      lines?.map((line) => [
        line.saleDate.toISOString().slice(0, 10),
        line.invoice,
        line.product,
        line.qty
      ])
    ).toEqual([
      ['2026-10-18', '900001', 'Nokian Remedy WRG5 - Passenger Tires', 4],
      ['2026-10-19', '900002', 'Nokian One - Passenger Tires', 2]
    ])
  } finally {
    await app.close()
    remove()
  }
})
