import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { openCredentials } from '../../src/main/credentials'

const folders: string[] = []
function folder(): string {
  const path = mkdtempSync(join(tmpdir(), 'auto-spiffer-credentials-'))
  folders.push(path)
  return path
}
afterEach(() => {
  for (const path of folders.splice(0)) {
    const resolved = realpathSync(path)
    if (!resolved.startsWith(realpathSync(tmpdir()) + sep))
      throw new Error('Unsafe test cleanup path')
    rmSync(resolved, { recursive: true, force: true })
  }
})

const encryption = {
  isEncryptionAvailable: () => true,
  encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
  decryptString: (value: Buffer) => value.toString().replace(/^encrypted:/, '')
}

it('stores only encrypted password bytes and never returns the password to the screen', () => {
  const path = folder()
  const credentials = openCredentials(path, encryption, vi.fn())
  expect(credentials.read()).toEqual({
    email: '',
    hasPassword: false,
    staySignedIn: true
  })
  credentials.save('shop@example.com', 'private-test-password')
  expect(credentials.read()).toEqual({
    email: 'shop@example.com',
    hasPassword: true,
    staySignedIn: true
  })
  expect(credentials.password()).toBe('private-test-password')
  const stored = readFileSync(join(path, 'credentials.json'), 'utf8')
  expect(stored).not.toContain('private-test-password')
  expect(stored).toContain('ZW5jcnlwdGVk')
})

it('refuses to save a password when account encryption is unavailable', () => {
  const path = folder()
  const credentials = openCredentials(
    path,
    { ...encryption, isEncryptionAvailable: () => false },
    vi.fn()
  )
  expect(() => credentials.save('shop@example.com', 'secret')).toThrow(
    'The password cannot be stored safely on this computer.'
  )
  expect(credentials.read().hasPassword).toBe(false)
  if (existsSync(join(path, 'credentials.json')))
    expect(readFileSync(join(path, 'credentials.json'), 'utf8')).not.toContain(
      'secret'
    )
})

it('keeps the sign-in preference and forgets the encrypted password', () => {
  const path = folder()
  const credentials = openCredentials(path, encryption, vi.fn())
  credentials.save('shop@example.com', 'secret')
  credentials.setStaySignedIn(false)
  credentials.forget()
  expect(openCredentials(path, encryption, vi.fn()).read()).toEqual({
    email: '',
    hasPassword: false,
    staySignedIn: false
  })
  expect(credentials.password()).toBeNull()
})
