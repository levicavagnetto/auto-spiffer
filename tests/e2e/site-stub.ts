import type { ElectronApplication } from '@playwright/test'

function pageStub(): void {
  type StubLine = {
    date: string
    invoice: string
    product: string
    qty: number
  }
  type Stub = {
    rows: StubLine[]
    files: string[]
    clicks: string[]
    posts: string[]
    nextClicked: boolean
    noClicked: boolean
    mode: 'normal' | 'duplicate' | 'rejected' | 'mismatch'
    lastError: string
  }
  const stateWindow = window as Window & {
    __stub?: Stub
    __doPostBack?: (target: string) => void
  }
  if (stateWindow.__stub) return
  const stub: Stub = {
    rows: [],
    files: [],
    clicks: [],
    posts: [],
    nextClicked: false,
    mode: 'normal',
    lastError: '',
    noClicked: false
  }
  stateWindow.__stub = stub
  const byId = (id: string): HTMLElement | null => document.getElementById(id)
  const input = (id: string): HTMLInputElement | null =>
    byId(id) as HTMLInputElement | null
  const show = (id: string): void => {
    const element = byId(id)
    if (element) {
      element.removeAttribute('hidden')
      element.style.display = 'block'
    }
  }
  const hide = (id: string): void => {
    const element = byId(id)
    if (element) {
      element.setAttribute('hidden', '')
      element.style.display = 'none'
    }
  }
  const duplicateId = 'DefaultContent_DuplicateLineItemMessagePopupPanel'
  const validationId = 'DefaultContent_ValidationPopupPanel'
  const dateId = 'ctl00_DefaultContent_InvoiceDateRadDatePicker_dateInput'
  const invoiceId = 'ctl00_DefaultContent_InvoiceNumberTextBox'
  const productId = 'DefaultContent_ProductDropdownList'
  const qtyId = 'ctl00_DefaultContent_QtyClaimedRadNumericTextBox'
  const gridId = 'ctl00_DefaultContent_ProductRadGrid_ctl00'

  const reject = (message: string): void => {
    stub.lastError = message
    const popup = byId(validationId)
    if (popup) {
      const body =
        popup.querySelector('.modal-body') ??
        popup.appendChild(document.createElement('div'))
      body.textContent = message
      if (!popup.querySelector('[data-stub-validation-ok]')) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = 'OK'
        button.setAttribute('data-stub-validation-ok', '')
        popup.appendChild(button)
      }
      show(validationId)
    }
  }
  const addRow = (force: boolean): void => {
    const date = input(dateId)?.value.trim() ?? ''
    const invoice = input(invoiceId)?.value.trim() ?? ''
    const selected = (byId(productId) as HTMLSelectElement | null)
      ?.selectedOptions[0]
    const product =
      selected?.value && selected.value !== '0' ? selected.text.trim() : ''
    const qty = Number(input(qtyId)?.value)
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date))
      return reject('Enter a sale date.')
    if (!invoice) return reject('Enter the invoice number.')
    if (!product) return reject('Select a product.')
    if (!Number.isInteger(qty) || qty < 1 || qty > 999)
      return reject('Enter a quantity.')
    if (stub.mode === 'rejected') return reject('The site rejected this line.')
    const duplicate = stub.rows.some(
      (row) =>
        row.date === date && row.invoice === invoice && row.product === product
    )
    if (!force && (duplicate || stub.mode === 'duplicate')) {
      show(duplicateId)
      return
    }
    const storedQty = stub.mode === 'mismatch' ? qty + 1 : qty
    const row = { date, invoice, product, qty: storedQty }
    stub.rows.push(row)
    const grid = byId(gridId)
    const body = grid?.querySelector('tbody')
    body?.querySelector('.rgNoRecords')?.remove()
    if (body) {
      const tr = document.createElement('tr')
      for (const text of [
        'Delete',
        date,
        invoice,
        product,
        String(storedQty)
      ]) {
        const td = document.createElement('td')
        td.textContent = text
        tr.appendChild(td)
      }
      body.appendChild(tr)
    }
    for (const id of [dateId, invoiceId, qtyId]) {
      const box = input(id)
      if (box) box.value = ''
    }
    const select = byId(productId) as HTMLSelectElement | null
    if (select) select.value = '0'
  }

  stateWindow.__doPostBack = (target: string): void => {
    stub.posts.push(target)
    if (target.endsWith('AddProductLinkButton')) addRow(false)
    if (target.endsWith('YesLinkButton')) addRow(true)
    if (target.includes('GoToStepFour')) stub.nextClicked = true
  }
  document.addEventListener(
    'click',
    (event) => {
      const element =
        event.target instanceof Element
          ? event.target.closest('button, a, input')
          : null
      if (!element) return
      if (element.id) stub.clicks.push(element.id)
      if (element.id === 'DefaultContent_AddProductLinkButton') {
        event.preventDefault()
        event.stopImmediatePropagation()
        addRow(false)
      } else if (
        element.closest(`#${duplicateId}`) &&
        element.textContent?.trim() === 'No'
      ) {
        stub.noClicked = true
        event.preventDefault()
        event.stopImmediatePropagation()
        hide(duplicateId)
      } else if (
        element.closest(`#${validationId}`) &&
        /^(ok|close|cancel)$/i.test(element.textContent?.trim() ?? '')
      ) {
        event.preventDefault()
        event.stopImmediatePropagation()
        hide(validationId)
      }
    },
    true
  )
  document.addEventListener(
    'change',
    (event) => {
      const element = event.target
      if (!(element instanceof HTMLInputElement) || element.type !== 'file')
        return
      if (!element.closest('#ctl00_DefaultContent_FileUploadRadAsyncUpload'))
        return
      event.stopImmediatePropagation()
      const panel = byId('DefaultContent_UploadedFilesPanel')
      let body = panel?.querySelector('table tbody')
      if (!body && panel) {
        const table = document.createElement('table')
        body = table.appendChild(document.createElement('tbody'))
        panel.appendChild(table)
      }
      for (const file of Array.from(element.files ?? [])) {
        stub.files.push(file.name)
        const row = document.createElement('tr')
        const cell = document.createElement('td')
        cell.textContent = file.name
        row.appendChild(cell)
        body?.appendChild(row)
        const done = document.createElement('span')
        done.className = 'ruUploadSuccess'
        done.textContent = file.name
        panel?.appendChild(done)
      }
      const replacement = element.cloneNode(false) as HTMLInputElement
      replacement.id = `${element.id}-next`
      element.replaceWith(replacement)
    },
    true
  )
}

export async function installSiteStub(app: ElectronApplication): Promise<void> {
  const script = `(${pageStub.toString()})()`
  await app.evaluate(async ({ BrowserWindow }, source) => {
    const view = BrowserWindow.getAllWindows()[0]!.contentView
      .children[0] as Electron.WebContentsView
    await view.webContents.executeJavaScript(source)
  }, script)
}
