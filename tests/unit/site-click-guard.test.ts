import { describe, expect, it } from 'vitest'
import { assertAllowedClick } from '../../src/main/site/click-guard'
import { neverClickSelectors } from '../../src/main/site/selectors'

describe('claim page click guard', () => {
  it.each(neverClickSelectors)('refuses %s', (selector) => {
    expect(() =>
      assertAllowedClick(selector, '', true, false, neverClickSelectors)
    ).toThrow('refused')
  })

  it('refuses Next and Submit labels on the claim page', () => {
    expect(() =>
      assertAllowedClick(
        '#some-button',
        'Next',
        true,
        false,
        neverClickSelectors
      )
    ).toThrow('refused')
    expect(() =>
      assertAllowedClick(
        '#some-button',
        ' Submit ',
        true,
        false,
        neverClickSelectors
      )
    ).toThrow('refused')
  })

  it('refuses a selector that resolves to a forbidden control', () => {
    expect(() =>
      assertAllowedClick(
        '.generic-button',
        'Continue',
        true,
        true,
        neverClickSelectors
      )
    ).toThrow('refused')
  })

  it('allows Add and duplicate No', () => {
    expect(() =>
      assertAllowedClick(
        '#DefaultContent_AddProductLinkButton',
        'Add',
        true,
        false,
        neverClickSelectors
      )
    ).not.toThrow()
    expect(() =>
      assertAllowedClick(
        '#duplicate-no',
        'No',
        true,
        false,
        neverClickSelectors
      )
    ).not.toThrow()
  })
})
