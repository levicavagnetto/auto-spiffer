import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { once } from 'node:events'
import { testUserData } from './test-user-data'

test('a normal app launch has no remote debugging switch', async () => {
  const { args, folder, remove } = testUserData()
  const diagnostic = join(folder, 'debug-switches.json')
  const child = spawn(
    resolve('node_modules/electron/dist/electron.exe'),
    args,
    {
      cwd: process.cwd(),
      env: { ...process.env, AUTO_SPIFFER_TEST_DIAGNOSTIC_FILE: diagnostic },
      stdio: 'ignore',
      windowsHide: true
    }
  )
  try {
    await expect.poll(() => existsSync(diagnostic)).toBe(true)
    expect(JSON.parse(readFileSync(diagnostic, 'utf8'))).toEqual({
      port: false,
      pipe: false
    })
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill()
      await once(child, 'exit')
    }
    remove()
  }
})
