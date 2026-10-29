import { _electron as electron, expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { installSiteStub } from './site-stub'
import { testUserData } from './test-user-data'

test('development live check adds one sale before offering upload', async () => {
  const { args, folder, remove } = testUserData()
  const pdfPath = join(folder, 'invoice.pdf')
  writeFileSync(pdfPath, '%PDF-1.4\n%%EOF\n')
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
    await page.getByText('Live check').click()
    await expect(
      page.getByRole('button', { name: 'Upload invoice PDF' })
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Read claim page' }).click()
    await page.getByLabel('Sale date').fill('2026-10-18')
    await page.getByLabel('Invoice number').fill('TEST-900201')
    await page
      .getByLabel('Eligible Product')
      .selectOption({ label: 'Nokian Remedy WRG5 - Passenger Tires' })
    await page.getByLabel('Quantity').fill('4')
    await page.getByRole('button', { name: 'Add test sale' }).click()
    await expect(
      page.getByText('Sale added and checked on the claim page.')
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Upload invoice PDF' })
    ).toBeDisabled()
    await page.getByLabel('Full PDF path').fill(pdfPath)
    await expect(
      page.getByRole('button', { name: 'Upload invoice PDF' })
    ).toBeEnabled()
    const read = await page.evaluate(() => window.api.readSitePage())
    expect(read?.lines).toContainEqual({
      saleDate: new Date('2026-10-18T00:00:00.000Z'),
      invoice: 'TEST-900201',
      product: 'Nokian Remedy WRG5 - Passenger Tires',
      qty: 4
    })
    await page.getByRole('button', { name: 'Upload invoice PDF' }).click()
    await expect(page.getByText('Invoice PDF uploaded.')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Upload invoice PDF' })
    ).toBeDisabled()
  } finally {
    await app.close()
    remove()
  }
})
