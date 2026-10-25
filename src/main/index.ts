import { app, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { registerIpc } from './ipc'
import { openSettings, type SettingsAccess } from './settings'
import { configureLog, reportUnexpected } from './log'
import { createSiteView } from './site/view'
import { createSiteDriver } from './site/driver'

app.setName('Auto Spiffer')
let mainWindow: BrowserWindow | undefined

function createWindow(settings: SettingsAccess): BrowserWindow {
  const bounds = settings.read().windowBounds
  const window = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })
  window.webContents.once('did-finish-load', () => {
    window.setSize(bounds.width, bounds.height)
    setTimeout(() => {
      if (window.isDestroyed()) return
      window.on('resize', () => {
        if (!window.isMaximized() && !window.isMinimized()) {
          const { width, height } = window.getBounds()
          settings.setWindowBounds({ width, height })
        }
      })
    }, 200)
  })

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return window
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore()
    mainWindow?.show()
    mainWindow?.focus()
  })

  void app.whenReady().then(() => {
    const logger = configureLog(app.getPath('userData'))
    if (!app.isPackaged && process.env.AUTO_SPIFFER_TEST_DIAGNOSTIC_FILE) {
      writeFileSync(
        process.env.AUTO_SPIFFER_TEST_DIAGNOSTIC_FILE,
        JSON.stringify({
          port: app.commandLine.hasSwitch('remote-debugging-port'),
          pipe: app.commandLine.hasSwitch('remote-debugging-pipe')
        })
      )
    }
    const onUnexpected = (error: unknown): void =>
      reportUnexpected(
        error,
        (detail) => logger.error(detail),
        (message) => mainWindow?.webContents.send('app:event:appError', message)
      )
    process.on('uncaughtException', onUnexpected)
    process.on('unhandledRejection', onUnexpected)
    nativeTheme.on('updated', () => {
      mainWindow?.webContents.send(
        'app:event:themeChanged',
        nativeTheme.shouldUseDarkColors
      )
    })
    const settings = openSettings(app.getPath('userData'), (message) =>
      logger.warn(message)
    )
    mainWindow = createWindow(settings)
    const site = createSiteView(mainWindow, (status) =>
      mainWindow?.webContents.send('app:event:siteStatusChanged', status)
    )
    const siteDriver = createSiteDriver(
      site.view.webContents,
      (message) => logger.warn(message),
      join(app.getPath('userData'), 'logs')
    )
    if (
      !app.isPackaged &&
      (process.env.AUTO_SPIFFER_TEST_SITE_FILE ||
        process.env.AUTO_SPIFFER_LIVE_CHECK === '1')
    ) {
      ;(globalThis as { __siteDriver?: typeof siteDriver }).__siteDriver =
        siteDriver
    }
    registerIpc(
      {
        getSettings: () => settings.read(),
        setTheme: (theme) => settings.setTheme(theme),
        getSystemTheme: () => nativeTheme.shouldUseDarkColors,
        getAppVersion: () => app.getVersion(),
        setSiteBounds: (bounds) => {
          site.setBounds(bounds)
          return undefined
        },
        getSiteStatus: () => site.getStatus(),
        reloadSite: () => {
          site.reload()
          return undefined
        },
        isClaimPage: () => siteDriver.isClaimPage(),
        readSitePage: () => siteDriver.readPage(),
        getLiveCheckAvailable: () => !app.isPackaged,
        testAddLine: (line) => {
          if (app.isPackaged)
            throw new Error('This check is only available in development.')
          return siteDriver.addLine(line)
        },
        testUpload: async (pdfPath) => {
          if (app.isPackaged)
            throw new Error('This check is only available in development.')
          await siteDriver.upload(pdfPath)
          return undefined
        }
      },
      (message) => logger.warn(message)
    )
  })
}

app.on('window-all-closed', () => app.quit())
