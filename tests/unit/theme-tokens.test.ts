import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve('src/renderer/src/globals.css'), 'utf8')

describe('shop theme', () => {
  it('defines every app color for light and dark modes', () => {
    const tokens = [
      'background',
      'sidebar',
      'card',
      'muted',
      'border',
      'foreground',
      'muted-foreground',
      'primary',
      'primary-foreground',
      'accent',
      'info',
      'info-foreground',
      'success',
      'success-foreground',
      'warning',
      'warning-foreground',
      'destructive',
      'destructive-foreground',
      'scrim'
    ]
    const light = css.match(/:root\s*\{([^}]+)\}/)?.[1] ?? ''
    const dark = css.match(/\.dark\s*\{([^}]+)\}/)?.[1] ?? ''

    for (const token of tokens) {
      expect(light, `light --${token}`).toContain(`--${token}:`)
      expect(dark, `dark --${token}`).toContain(`--${token}:`)
    }
  })
})
