import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Windows app icon', () => {
  it('contains the required icon sizes', () => {
    const icon = readFileSync(join(process.cwd(), 'build', 'icon.ico'))
    expect(icon.readUInt16LE(0)).toBe(0)
    expect(icon.readUInt16LE(2)).toBe(1)

    const count = icon.readUInt16LE(4)
    const sizes = new Set<number>()
    for (let index = 0; index < count; index += 1) {
      const offset = 6 + index * 16
      const width = icon.readUInt8(offset) || 256
      const height = icon.readUInt8(offset + 1) || 256
      expect(width).toBe(height)
      sizes.add(width)
    }

    expect([...sizes].sort((a, b) => a - b)).toEqual([16, 32, 48, 256])
  })
})
