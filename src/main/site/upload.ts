import type { WebContents } from 'electron'
import { statSync } from 'node:fs'
import { isAbsolute, extname } from 'node:path'
import { selectors } from './selectors'

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

async function uploadedCount(webContents: WebContents): Promise<number> {
  return webContents.executeJavaScript(`(() =>
    document.querySelectorAll(${JSON.stringify(selectors.uploadedRows)}).length +
    document.querySelectorAll(${JSON.stringify(selectors.uploadSuccess)}).length
  )()`)
}

export async function uploadPdf(
  webContents: WebContents,
  isClaimPage: () => Promise<boolean>,
  pdfPath: string
): Promise<void> {
  if (!isAbsolute(pdfPath) || extname(pdfPath).toLowerCase() !== '.pdf')
    throw new Error('Choose a PDF invoice file to upload.')
  try {
    if (!statSync(pdfPath).isFile()) throw new Error('Not a file')
  } catch {
    throw new Error('The invoice PDF could not be found. Choose it again.')
  }
  if (!(await isClaimPage()))
    throw new Error('Open the claim page before uploading an invoice.')
  const before = await uploadedCount(webContents)
  const debuggerApi = webContents.debugger
  try {
    if (!debuggerApi.isAttached()) debuggerApi.attach('1.3')
    const response = (await debuggerApi.sendCommand('Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll(${JSON.stringify(selectors.upload)})).at(-1)`,
      returnByValue: false
    })) as { result?: { objectId?: string } }
    const objectId = response.result?.objectId
    if (!objectId) throw new Error('Upload box missing')
    await debuggerApi.sendCommand('DOM.setFileInputFiles', {
      objectId,
      files: [pdfPath]
    })
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      try {
        if ((await uploadedCount(webContents)) > before) return
      } catch {
        // A navigation during upload is checked again until the deadline.
      }
      await sleep(100)
    }
    throw new Error('Upload did not finish')
  } catch {
    throw new Error(
      'The invoice did not finish uploading. Check the website and try again.'
    )
  }
}
