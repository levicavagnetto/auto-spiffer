import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  .version as string
const script = join(root, 'scripts', 'check-release-tag.mjs')

function check(tag: string) {
  return spawnSync(process.execPath, [script, tag], {
    cwd: root,
    encoding: 'utf8'
  })
}

describe('release tag gate', () => {
  it('accepts the package version tag', () => {
    expect(check(`v${version}`).status).toBe(0)
  })

  it('rejects a version mismatch before packaging', () => {
    const result = check('v999.0.0')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('does not match package.json')
  })

  it('rejects a malformed tag', () => {
    const result = check('not-a-version')
    expect(result.status).toBe(1)
  })
})
