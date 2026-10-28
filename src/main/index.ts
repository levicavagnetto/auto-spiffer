import {
  app,
  BrowserWindow,
  dialog,
  nativeTheme,
  safeStorage,
  session,
  shell
} from 'electron'
import { join, resolve, sep } from 'node:path'
import { writeFileSync } from 'node:fs'
import { registerIpc } from './ipc'
import { openSettings, type SettingsAccess } from './settings'
import { openCredentials, type CredentialsAccess } from './credentials'
import { configureLog, reportUnexpected } from './log'
import { createSiteView } from './site/view'
import { createSiteDriver } from './site/driver'
import { createSignInController } from './site/signin'
import { createClaimNavigator } from './site/navigate'
import { InvoiceWorker } from './invoices/reader'
import { SalesSession } from './sales/session'
import { ReviewSession } from './matching/session'
import { openSavedMatches } from './matching/saved-matches'
import { RunSession } from './run/session'
import { autoUpdater } from 'electron-updater'
import {
  configureUpdateClient,
  createUpdateController,
  type UpdateController
} from './updates'

app.setName('Auto Spiffer')
let mainWindow: BrowserWindow | undefined
let invoiceWorker: InvoiceWorker | undefined
let activeRun: RunSession | undefined
let activeCredentials: CredentialsAccess | undefined
let siteStorageClearedOnQuit = false
let clearingSiteStorage = false

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
    const credentials = openCredentials(
      app.getPath('userData'),
      safeStorage,
      (message) => logger.warn(message)
    )
    activeCredentials = credentials
    mainWindow = createWindow(settings)
    const site = createSiteView(mainWindow, (status) => {
      mainWindow?.webContents.send('app:event:siteStatusChanged', status)
      if (status.state === 'ready') void signIn.maybeSignIn()
    })
    const siteDriver = createSiteDriver(
      site.view.webContents,
      (message) => logger.warn(message),
      join(app.getPath('userData'), 'logs')
    )
    const signIn = createSignInController({
      whereAmI: () => siteDriver.whereAmI(),
      saved: () => {
        const password = credentials.password()
        return password ? { email: credentials.read().email, password } : null
      },
      fillAndClick: (email, password) => siteDriver.fillLogin(email, password),
      attention: (message) =>
        mainWindow?.webContents.send('app:event:signInAttention', message),
      now: () => Date.now(),
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    })
    const claimNavigator = createClaimNavigator({
      whereAmI: () => siteDriver.whereAmI(),
      openSubmitSale: () => site.openSubmitSale(),
      chooseProgram: (month) => siteDriver.chooseProgram(month),
      clickProgramNext: () => siteDriver.clickProgramNext(),
      signIn: () => signIn.maybeSignIn(),
      attention: (message) =>
        mainWindow?.webContents.send('app:event:siteNeedsAttention', message),
      now: () => Date.now(),
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    })
    invoiceWorker = new InvoiceWorker()
    const sales = new SalesSession((path) => invoiceWorker!.read(path))
    const savedMatches = openSavedMatches(
      app.getPath('userData'),
      (message) => logger.warn(message),
      (message) => mainWindow?.webContents.send('app:event:appError', message)
    )
    const review = new ReviewSession(
      () => sales.snapshot(),
      () =>
        site.getStatus().state === 'notOpened'
          ? Promise.resolve(null)
          : siteDriver.readPage(),
      savedMatches
    )
    const run = new RunSession({
      review: () => review.snapshot(),
      month: () => sales.snapshot()?.state.month ?? null,
      readPage: () =>
        site.getStatus().state === 'notOpened'
          ? Promise.resolve(null)
          : siteDriver.readPage(),
      driver: siteDriver,
      log: (error) => logger.warn(`Claim page read failed: ${String(error)}`),
      publish: (state) => {
        mainWindow?.webContents.send('app:event:runStateChanged', state)
        updates.onRunStateChanged()
      },
      maxLines:
        !app.isPackaged && process.env.AUTO_SPIFFER_LIVE_MAX_LINES === '2'
          ? 2
          : undefined
    })
    activeRun = run
    configureUpdateClient(
      autoUpdater,
      app.getVersion(),
      process.env.AUTO_SPIFFER_UPDATE_CHANNEL
    )
    autoUpdater.logger = logger
    logger.info(`Update channel: ${autoUpdater.channel}`)
    const updates: UpdateController = createUpdateController({
      version: app.getVersion(),
      automatic: () => settings.read().automaticUpdates,
      saveAutomatic: (value) => {
        settings.setAutomaticUpdates(value)
      },
      runActive: () => run.active,
      check: async () => {
        await autoUpdater.checkForUpdates()
      },
      closeSite: () => {
        if (!site.view.webContents.isDestroyed()) site.view.webContents.close()
      },
      install: () => autoUpdater.quitAndInstall(true, true),
      log: (message) => logger.warn(message),
      publish: (state) =>
        mainWindow?.webContents.send('app:event:updateStateChanged', state),
      schedule: (callback, delay) => {
        const timer = setInterval(callback, delay)
        timer.unref()
        return () => clearInterval(timer)
      }
    })
    autoUpdater.on('update-available', (info) =>
      updates.receive({ kind: 'available', version: info.version })
    )
    autoUpdater.on('update-not-available', () =>
      updates.receive({ kind: 'not-available' })
    )
    autoUpdater.on('download-progress', () =>
      updates.receive({ kind: 'progress' })
    )
    autoUpdater.on('update-downloaded', (info) =>
      updates.receive({ kind: 'downloaded', version: info.version })
    )
    autoUpdater.on('error', (error) =>
      updates.receive({ kind: 'error', message: String(error) })
    )
    const ensureNoRun = (): void => {
      if (run.active)
        throw new Error(
          'Wait for claim entry to finish before changing sales or the claim page.'
        )
    }
    let closePending = false
    let closeDialogOpen = false
    mainWindow.on('close', (event) => {
      if (closePending || !run.active) return
      event.preventDefault()
      if (closeDialogOpen) return
      closeDialogOpen = true
      void (async () => {
        try {
          const choice = await dialog.showMessageBox(mainWindow!, {
            type: 'warning',
            title: 'Claim entry is in progress',
            message:
              'A claim is being entered. Stop after this line and close?',
            detail:
              'The current sale will finish first. Check the claim page before submitting.',
            buttons: ['Keep entering', 'Stop and close'],
            defaultId: 0,
            cancelId: 0,
            noLink: true
          })
          if (choice.response !== 1) return
          await run.stopAndWait()
          closePending = true
          mainWindow?.close()
        } finally {
          closeDialogOpen = false
        }
      })()
    })
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
        getCredentials: () => credentials.read(),
        saveCredentials: ({ email, password }) =>
          credentials.save(email, password),
        setStaySignedIn: (value) => credentials.setStaySignedIn(value),
        forgetCredentials: async () => {
          ensureNoRun()
          const state = credentials.forget()
          await site.signOut()
          return state
        },
        getSettings: () => settings.read(),
        setTheme: (theme) => settings.setTheme(theme),
        getSystemTheme: () => nativeTheme.shouldUseDarkColors,
        getAppVersion: () => app.getVersion(),
        getUpdateState: () => updates.snapshot(),
        checkForUpdates: async () => {
          if (!app.isPackaged)
            throw new Error('Install Auto Spiffer to check for updates.')
          await updates.checkNow()
          return updates.snapshot()
        },
        setAutomaticUpdates: (value) => updates.setAutomatic(value),
        restartToUpdate: () => updates.restartToUpdate(),
        openLogsFolder: async () => {
          const error = await shell.openPath(
            join(app.getPath('userData'), 'logs')
          )
          if (error) throw new Error('Could not open the logs folder.')
          return undefined
        },
        setSiteBounds: (bounds) => {
          site.setBounds(bounds)
          return undefined
        },
        getSiteStatus: () => site.getStatus(),
        getSiteLocation: () => siteDriver.whereAmI(),
        retrySignIn: async () => {
          ensureNoRun()
          await signIn.retry()
          return undefined
        },
        reloadSite: () => {
          ensureNoRun()
          site.reload()
          return undefined
        },
        isClaimPage: () => siteDriver.isClaimPage(),
        readSitePage: () => siteDriver.readPage(),
        getLiveCheckAvailable: () => !app.isPackaged,
        testAddLine: (line) => {
          ensureNoRun()
          if (app.isPackaged)
            throw new Error('This check is only available in development.')
          return siteDriver.addLine(line)
        },
        testUpload: async (pdfPath) => {
          ensureNoRun()
          if (app.isPackaged)
            throw new Error('This check is only available in development.')
          await siteDriver.upload(pdfPath)
          return undefined
        },
        getSalesSnapshot: () => sales.snapshot(),
        pickSalesExport: async () => {
          ensureNoRun()
          const choice = await dialog.showOpenDialog(mainWindow!, {
            title: 'Choose Material Sales export',
            properties: ['openFile'],
            filters: [{ name: 'Excel workbooks', extensions: ['xlsx'] }]
          })
          ensureNoRun()
          if (choice.canceled) return sales.snapshot()
          const result = await sales.loadExport(choice.filePaths[0]!)
          review.reset()
          run.reset()
          return result
        },
        loadSalesExport: async (path) => {
          ensureNoRun()
          const result = await sales.loadExport(path)
          review.reset()
          run.reset()
          return result
        },
        pickInvoicePdfs: async () => {
          ensureNoRun()
          const choice = await dialog.showOpenDialog(mainWindow!, {
            title: 'Choose invoice PDFs',
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Invoice PDFs', extensions: ['pdf'] }]
          })
          ensureNoRun()
          return choice.canceled
            ? sales.snapshot()
            : sales.addPaths(choice.filePaths)
        },
        pickInvoiceFolder: async () => {
          ensureNoRun()
          const choice = await dialog.showOpenDialog(mainWindow!, {
            title: 'Choose invoice folder',
            properties: ['openDirectory']
          })
          ensureNoRun()
          return choice.canceled
            ? sales.snapshot()
            : sales.addPaths(choice.filePaths)
        },
        addInvoicePaths: (paths) => {
          ensureNoRun()
          return sales.addPaths(paths)
        },
        removeInvoicePdf: (path) => {
          ensureNoRun()
          return sales.removePdf(path)
        },
        getReviewSnapshot: () => review.snapshot(),
        matchTires: async () => {
          ensureNoRun()
          const month = sales.snapshot()?.state.month
          if (!month) throw new Error('Choose a month of sales first.')
          await claimNavigator.open(month)
          return review.match()
        },
        decideTire: (input) => {
          ensureNoRun()
          return review.decide(input)
        },
        setLineLeftOut: (input) => {
          ensureNoRun()
          return review.setLeftOut(input)
        },
        listSavedMatches: () => review.savedMatches(),
        removeSavedMatch: (signature) => {
          review.removeSaved(signature)
          return undefined
        },
        getRunState: () => run.snapshot(),
        getRunLimit: () =>
          !app.isPackaged && process.env.AUTO_SPIFFER_LIVE_MAX_LINES === '2'
            ? 2
            : null,
        checkRunPage: () => run.check(),
        startRun: () => run.start(),
        pauseRun: () => run.pause(),
        resumeRun: () => run.resume(),
        stopRun: () => run.stop(),
        openRunScreenshot: async (path) => {
          const folder = resolve(app.getPath('userData'), 'logs')
          const target = resolve(path)
          if (
            !target.startsWith(folder + sep) ||
            !run
              .snapshot()
              .summary?.failed.some((item) => item.screenshot === target)
          )
            throw new Error('That picture is not part of the current run.')
          const error = await shell.openPath(target)
          if (error)
            throw new Error(
              'Could not open that picture. Check the logs folder.'
            )
          return undefined
        }
      },
      (message) => logger.warn(message)
    )
    if (app.isPackaged) updates.start()
  })
}

app.on('window-all-closed', () => app.quit())
app.on('before-quit', (event) => {
  if (activeRun?.active) {
    event.preventDefault()
    mainWindow?.close()
    return
  }
  if (!activeCredentials?.read().staySignedIn && !siteStorageClearedOnQuit) {
    event.preventDefault()
    if (clearingSiteStorage) return
    clearingSiteStorage = true
    void session
      .fromPartition('persist:prorewards')
      .clearStorageData()
      .finally(() => {
        siteStorageClearedOnQuit = true
        app.quit()
      })
    return
  }
  void invoiceWorker?.close()
})
