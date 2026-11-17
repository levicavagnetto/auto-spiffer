import { expect, it } from 'vitest'
import { wheelSignature } from '../../src/main/matching/wheel'

it('ignores wheel size, bolt pattern and offset', () => {
  expect(wheelSignature('XW OFFROAD XW-123 20X9 8X165.1 +12 BLACK')).toBe(
    'wheel|xw offroad xw-123 black'
  )
  expect(wheelSignature('XW OFFROAD XW-123 18X9 6X139.7 +0 BLACK')).toBe(
    'wheel|xw offroad xw-123 black'
  )
  expect(wheelSignature('STYLE A 20X10 -12 5X5.00 BLACK')).toBe(
    'wheel|style a black'
  )
})
