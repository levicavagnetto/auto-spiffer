import { _electron as electron, expect, test } from '@playwright/test'
import { join } from 'node:path'
import { testUserData } from './test-user-data'

test('a failed site load stays marked as a load failure', async () => {
  const { args, folder, remove } = testUserData()
  const app = await electron.launch({
    args,
    env: {
      ...process.env,
      AUTO_SPIFFER_TEST_SITE_FILE: join(folder, 'missing-page.html')
    }
  })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect(page.getByText('Could not load')).toBeVisible()
    await page.waitForTimeout(300)
    await expect(page.getByText('Could not load')).toBeVisible()
  } finally {
    await app.close()
    remove()
  }
})
