import { describe, expect, it } from 'vitest'
import { hasTireSize } from '../../src/main/matching/sizes'

describe('hasTireSize', () => {
  it.each([
    '235/50R18',
    '255/35ZR19XL',
    'LT265/75R16/10',
    'ST205/75R14/8',
    '35X12.5R18LT/12',
    'LT37X12.50R20/10',
    '18X8.50/9.50-8'
  ])('recognizes %s', (description) => {
    expect(hasTireSize(description)).toBe(true)
  })

  it.each([
    'Shipping and Handling',
    'Tire 235/50R1800',
    'ABC235/50R18DEF',
    'order/235/50R18',
    'Nokian One HT'
  ])('does not treat %s as a size', (description) => {
    expect(hasTireSize(description)).toBe(false)
  })
})
