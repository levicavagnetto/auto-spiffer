import { describe, expect, it } from 'vitest'
import { chooseMonth, classifySale } from '../../src/main/sales/rules'
import type { Sale } from '../../src/shared/sales'

const sale = (saleDate: string, notATire: Sale['notATire'] = null): Sale => ({
  row: 1,
  saleDate,
  invoice: 'TEST-900001',
  description: '235/50R18 GEN RT45',
  qty: 1,
  notATire
})

describe('classifySale', () => {
  it.each([
    ['Shipping and Handling', 'shipping'],
    ['Handling fee', 'shipping'],
    ['18X8.50/9.50-8 FST IMPORT TR13 TUBE 18X850/950-8', 'tube'],
    ['Nokian One', 'no-size'],
    ['ATD Steel Wheels 225/65R17', 'wheel'],
    ['Steel wheel rim 20X9', 'wheel'],
    ['XW OFFROAD XW-123 20X9 8X165.1 +12 BLACK', 'wheel'],
    ['STYLE A 20X10 -12 5X5.00 BLACK', 'wheel'],
    ['Wheel alignment service', 'no-size'],
    ['Wheel bearing kit', 'no-size'],
    ['20X9 BLACK', 'no-size'],
    ['20X9 8X165.1 TUBE', 'tube'],
    ['20X9 8X165.1 SHIPPING', 'shipping'],
    ['235/50R18 GEN RT45', null]
  ] as const)('classifies %s', (description, expected) => {
    expect(classifySale(description)).toBe(expected)
  })
})

describe('chooseMonth', () => {
  it('uses the only month without a warning', () => {
    expect(chooseMonth([sale('2026-09-03'), sale('2026-09-27')])).toEqual({
      month: '2026-09'
    })
  })

  it('names all months and chooses the one with more tire rows', () => {
    const selection = chooseMonth([
      sale('2026-09-03'),
      sale('2026-09-27'),
      sale('2026-09-28', 'tube'),
      sale('2026-10-01')
    ])
    expect(selection.month).toBe('2026-09')
    expect(selection.monthWarning).toContain('September 2026 (2)')
    expect(selection.monthWarning).toContain('October 2026 (1)')
  })
})
