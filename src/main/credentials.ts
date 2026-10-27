import ElectronStore from 'electron-store'
import { z } from 'zod'

const storedSchema = z.object({
  email: z.string(),
  encryptedPassword: z.string(),
  staySignedIn: z.boolean()
})

type Stored = z.output<typeof storedSchema>
export type CredentialsState = {
  email: string
  hasPassword: boolean
  staySignedIn: boolean
}
export type AccountEncryption = {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

export interface CredentialsAccess {
  read(): CredentialsState
  password(): string | null
  save(email: string, password: string): CredentialsState
  setStaySignedIn(value: boolean): CredentialsState
  forget(): CredentialsState
}

const defaults: Stored = {
  email: '',
  encryptedPassword: '',
  staySignedIn: true
}

export function openCredentials(
  folder: string,
  encryption: AccountEncryption,
  log: (message: string) => void
): CredentialsAccess {
  const store = new ElectronStore<Stored>({
    cwd: folder,
    name: 'credentials',
    defaults,
    clearInvalidConfig: true,
    deserialize: (text) => {
      try {
        return storedSchema.parse(JSON.parse(text))
      } catch {
        log('Credentials file was damaged; defaults restored')
        throw new SyntaxError('Invalid credentials file')
      }
    }
  })
  const read = (): CredentialsState => {
    const stored = storedSchema.parse(store.store)
    return {
      email: stored.email,
      hasPassword: Boolean(stored.encryptedPassword),
      staySignedIn: stored.staySignedIn
    }
  }
  return {
    read,
    password() {
      const stored = storedSchema.parse(store.store)
      if (!stored.encryptedPassword) return null
      try {
        return encryption.decryptString(
          Buffer.from(stored.encryptedPassword, 'base64')
        )
      } catch {
        log('Saved password could not be decrypted')
        return null
      }
    },
    save(email, password) {
      const safeEmail = z.email().parse(email.trim())
      if (!password) throw new Error('Enter a password to save.')
      if (!encryption.isEncryptionAvailable())
        throw new Error(
          'The password cannot be stored safely on this computer.'
        )
      let encrypted: string
      try {
        encrypted = encryption.encryptString(password).toString('base64')
      } catch {
        throw new Error(
          'The password cannot be stored safely on this computer.'
        )
      }
      store.set({
        ...store.store,
        email: safeEmail,
        encryptedPassword: encrypted
      })
      return read()
    },
    setStaySignedIn(value) {
      store.set('staySignedIn', value)
      return read()
    },
    forget() {
      store.set({ ...store.store, email: '', encryptedPassword: '' })
      return read()
    }
  }
}
