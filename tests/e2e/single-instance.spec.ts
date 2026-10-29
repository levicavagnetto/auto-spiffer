import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { once } from 'node:events'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { testUserData } from './test-user-data'

const electronPath = createRequire(join(process.cwd(), 'package.json'))(
  'electron'
) as string

test('a second launch focuses the existing window and exits', async () => {
  const { args, remove } = testUserData()
  const app = await electron.launch({ args })
  let second: ReturnType<typeof spawn> | undefined
  try {
    const page = await app.firstWindow()
    await expect(page).toHaveTitle('Auto Spiffer')
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.minimize()
    )

    second = spawn(electronPath, args, { cwd: process.cwd(), stdio: 'ignore' })
    const exit = await Promise.race([
      once(second, 'exit').then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 2000))
    ])
    expect(exit).toBe(true)
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0]?.isMinimized()
        )
      )
      .toBe(false)
  } finally {
    if (second && second.exitCode === null) second.kill()
    await app.close()
    remove()
  }
})
