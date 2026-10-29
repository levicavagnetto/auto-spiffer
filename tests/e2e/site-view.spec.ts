import { _electron as electron, expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { testUserData } from './test-user-data'

test('ProRewards view follows its screen and hides on Sales', async () => {
  const { args, remove } = testUserData()
  const app = await electron.launch({ args })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) => {
          const child =
            BrowserWindow.getAllWindows()[0]?.contentView.children[0]
          return child?.getVisible() ?? false
        })
      )
      .toBe(true)
    const bounds = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.contentView.children[0]?.getBounds()
    )
    expect(bounds?.width).toBeGreaterThan(400)
    expect(bounds?.height).toBeGreaterThan(300)
    await page.getByRole('button', { name: 'Sales' }).click()
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) => {
          const child =
            BrowserWindow.getAllWindows()[0]?.contentView.children[0]
          return child?.getVisible() ?? false
        })
      )
      .toBe(false)
  } finally {
    await app.close()
    remove()
  }
})

test('embedded website stays square between rounded top and bottom bars', async () => {
  const { args, remove } = testUserData()
  const app = await electron.launch({ args })
  try {
    const page = await app.firstWindow()
    await app.evaluate(({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      const original = view.setBorderRadius.bind(view)
      view.setBorderRadius = (radius: number) => {
        ;(globalThis as { __siteRadius?: number }).__siteRadius = radius
        original(radius)
      }
    })
    await page.getByRole('button', { name: 'ProRewards' }).click()
    await expect
      .poll(() =>
        app.evaluate(
          () => (globalThis as { __siteRadius?: number }).__siteRadius
        )
      )
      .toBe(0)
    const website = await page.getByLabel('ProRewards website').boundingBox()
    const bottomBar = await page.getByLabel('Website bottom bar').boundingBox()
    expect(website).not.toBeNull()
    expect(bottomBar).not.toBeNull()
    expect(
      Math.abs(bottomBar!.y - (website!.y + website!.height))
    ).toBeLessThan(2)
    expect(bottomBar!.height).toBeGreaterThan(0)
  } finally {
    await app.close()
    remove()
  }
})

test('an external link does not replace the in-app site tab', async () => {
  const { args, folder, remove } = testUserData()
  const fixture = join(folder, 'links.html')
  writeFileSync(fixture, '<a href="https://example.org/">Leave</a>')
  const app = await electron.launch({ args })
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: 'ProRewards' }).click()
    const initialUrl = await app.evaluate(
      async ({ BrowserWindow, shell }, fixtureUrl) => {
        const view = BrowserWindow.getAllWindows()[0]!.contentView
          .children[0] as Electron.WebContentsView
        shell.openExternal = async (url) => {
          ;(globalThis as { __externalUrl?: string }).__externalUrl = url
        }
        await view.webContents.loadURL(fixtureUrl)
        return view.webContents.getURL()
      },
      pathToFileURL(fixture).href
    )
    await app.evaluate(async ({ BrowserWindow }) => {
      const view = BrowserWindow.getAllWindows()[0]!.contentView
        .children[0] as Electron.WebContentsView
      await view.webContents.executeJavaScript(
        'document.querySelector("a").click()'
      )
    })
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) => {
          const view = BrowserWindow.getAllWindows()[0]!.contentView
            .children[0] as Electron.WebContentsView
          return view.webContents.getURL()
        })
      )
      .toBe(initialUrl)
    await expect
      .poll(() =>
        app.evaluate(
          () => (globalThis as { __externalUrl?: string }).__externalUrl
        )
      )
      .toBe('https://example.org/')
  } finally {
    await app.close()
    remove()
  }
})
