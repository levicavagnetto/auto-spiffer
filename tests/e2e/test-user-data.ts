import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'

export function testUserData(): {
  args: string[]
  folder: string
  remove: () => void
} {
  const folder = mkdtempSync(join(tmpdir(), 'auto-spiffer-e2e-'))
  return {
    args: ['.', `--user-data-dir=${folder}`],
    folder,
    remove() {
      const resolved = realpathSync(folder)
      if (!resolved.startsWith(realpathSync(tmpdir()) + sep))
        throw new Error('Unsafe test cleanup path')
      rmSync(resolved, {
        recursive: true,
        force: true,
        maxRetries: 30,
        retryDelay: 200
      })
    }
  }
}
