import { describe, expect, it } from 'vitest'
import {
  isSiteNavigation,
  shouldOpenExternalWindow
} from '../../src/main/site/links'

describe('ProRewards link rules', () => {
  it('keeps only HTTPS ProRewards pages in the tab', () => {
    expect(
      isSiteNavigation('https://prorewards.acbrewards.com/Login.aspx')
    ).toBe(true)
    expect(isSiteNavigation('https://example.org/')).toBe(false)
    expect(
      isSiteNavigation('https://prorewards.acbrewards.com.evil.test/')
    ).toBe(false)
    expect(isSiteNavigation('http://prorewards.acbrewards.com/')).toBe(false)
  })

  it('sends safe new windows to the browser and leaves ClaimForm alone', () => {
    expect(shouldOpenExternalWindow('https://example.org/help')).toBe(true)
    expect(
      shouldOpenExternalWindow(
        'https://prorewards.acbrewards.com/ClaimForm.aspx?pid=1'
      )
    ).toBe(false)
    expect(shouldOpenExternalWindow('file:///C:/secret.txt')).toBe(false)
    expect(shouldOpenExternalWindow('javascript:alert(1)')).toBe(false)
  })
})
