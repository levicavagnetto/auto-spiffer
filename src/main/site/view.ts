import { app, BrowserWindow, WebContentsView, session, shell } from 'electron'
import { pathToFileURL } from 'node:url'
import type { SiteStatus } from '../../shared/ipc'
import { isSiteNavigation, shouldOpenExternalWindow } from './links'

const siteUrl = 'https://prorewards.acbrewards.com/'

export function createSiteView(
  window: BrowserWindow,
  onStatus: (status: SiteStatus) => void
): {
  view: WebContentsView
  setBounds: (bounds: Electron.Rectangle | null) => void
  getStatus: () => SiteStatus
  ensureLoaded: () => Promise<void>
  reload: () => void
  signOut: () => Promise<void>
  openSubmitSale: () => Promise<void>
} {
  const view = new WebContentsView({
    webPreferences: {
      session: session.fromPartition('persist:prorewards'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })
  const testFile = !app.isPackaged
    ? process.env.AUTO_SPIFFER_TEST_SITE_FILE
    : undefined
  if (testFile) {
    view.webContents.session.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: !details.url.startsWith('file:') })
    })
  }
  window.contentView.addChildView(view)
  view.setVisible(false)
  let loaded = false
  let status: SiteStatus = { address: siteUrl, state: 'notOpened' }
  const publish = (state: SiteStatus['state']): void => {
    status = { address: view.webContents.getURL() || siteUrl, state }
    onStatus(status)
  }
  view.webContents.on('did-start-loading', () => publish('loading'))
  view.webContents.on('did-stop-loading', () => {
    if (status.state !== 'error') publish('ready')
  })
  view.webContents.on('did-fail-load', (_event, code) => {
    if (code !== -3) publish('error')
  })
  view.webContents.on('did-navigate', () => {
    if (status.state !== 'error') publish('ready')
  })
  view.webContents.on('will-navigate', (event, address) => {
    if (isSiteNavigation(address)) return
    event.preventDefault()
    if (shouldOpenExternalWindow(address)) void shell.openExternal(address)
  })
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternalWindow(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  const ensureLoaded = async (): Promise<void> => {
    if (loaded) return
    loaded = true
    try {
      await view.webContents.loadURL(
        testFile ? pathToFileURL(testFile).href : siteUrl
      )
    } catch (error) {
      loaded = false
      publish('error')
      throw error
    }
  }
  return {
    view,
    getStatus: () => status,
    ensureLoaded,
    reload: () => view.webContents.reload(),
    async openSubmitSale() {
      loaded = true
      const address = testFile
        ? pathToFileURL(testFile).href
        : new URL('authorized/claims/submitsale.aspx', siteUrl).href
      await view.webContents.loadURL(address)
    },
    async signOut() {
      await view.webContents.session.clearStorageData()
      if (loaded)
        await view.webContents.loadURL(
          testFile ? pathToFileURL(testFile).href : `${siteUrl}Login.aspx`
        )
    },
    setBounds(bounds) {
      if (!bounds) {
        view.setVisible(false)
        return
      }
      view.setBounds(bounds)
      view.setBorderRadius(0)
      view.setVisible(true)
      if (!loaded) {
        void ensureLoaded().catch(() => undefined)
      }
    }
  }
}
