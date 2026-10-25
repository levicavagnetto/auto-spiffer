const siteOrigin = 'https://prorewards.acbrewards.com'

export function isSiteNavigation(address: string): boolean {
  try {
    return new URL(address).origin === siteOrigin
  } catch {
    return false
  }
}

export function shouldOpenExternalWindow(address: string): boolean {
  try {
    const url = new URL(address)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    return !(
      url.origin === siteOrigin &&
      url.pathname.toLowerCase().endsWith('/claimform.aspx')
    )
  } catch {
    return false
  }
}
