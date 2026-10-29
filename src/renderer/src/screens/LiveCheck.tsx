import { useState } from 'react'

type Busy = 'reading' | 'adding' | 'uploading' | null

export function LiveCheck(): React.JSX.Element {
  const [tires, setTires] = useState<string[]>([])
  const [saleDate, setSaleDate] = useState('')
  const [invoice, setInvoice] = useState('')
  const [product, setProduct] = useState('')
  const [qty, setQty] = useState('1')
  const [pdfPath, setPdfPath] = useState('')
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [result, setResult] = useState('')

  const readPage = async (): Promise<void> => {
    setBusy('reading')
    setAdded(false)
    setResult('')
    try {
      const page = await window.api.readSitePage()
      if (!page) {
        setTires([])
        setProduct('')
        setResult('Open the Submit a Sales Claim page, then read it again.')
        return
      }
      setTires(page.tires)
      setProduct('')
      setResult(
        `Claim page ready. ${page.tires.length} eligible products found.`
      )
    } catch {
      setResult(
        'Could not read the claim page. Check the website and try again.'
      )
    } finally {
      setBusy(null)
    }
  }

  const addSale = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy('adding')
    setAdded(false)
    setResult('')
    try {
      const outcome = await window.api.testAddLine({
        saleDate: new Date(`${saleDate}T00:00:00.000Z`),
        invoice: invoice.trim(),
        product,
        qty: Number(qty)
      })
      setAdded(outcome.kind === 'added')
      const summary =
        outcome.kind === 'added'
          ? 'Sale added and checked on the claim page.'
          : outcome.message || 'The sale was not added. Check the claim page.'
      setResult(
        `${summary} Fill: ${outcome.timing.fillMs} ms. Add: ${outcome.timing.addMs} ms.`
      )
    } catch {
      setResult('Could not add the sale. Check the claim page and the app log.')
    } finally {
      setBusy(null)
    }
  }

  const upload = async (): Promise<void> => {
    setBusy('uploading')
    setResult('Uploading the invoice PDF. This may take a minute.')
    try {
      await window.api.testUpload(pdfPath.trim().replace(/^"(.*)"$/, '$1'))
      setAdded(false)
      setResult(
        'Invoice PDF uploaded. Check the sale and file on the website, then remove both.'
      )
    } catch {
      setResult('The invoice did not upload. Check the website and try again.')
    } finally {
      setBusy(null)
    }
  }

  const field =
    'h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground'
  const button =
    'rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <details className="shrink-0 border-b border-border px-4 py-2 text-sm">
      <summary className="cursor-pointer font-medium">Live check</summary>
      <p className="mt-2 text-muted-foreground">
        Test one sale on the live claim page. This check does not submit the
        claim. Remove the test sale and PDF on the website after checking them.
      </p>
      <div className="mt-3">
        <button
          type="button"
          className={button}
          disabled={busy !== null}
          onClick={() => void readPage()}
        >
          Read claim page
        </button>
      </div>
      <form
        onSubmit={(event) => void addSale(event)}
        className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4"
      >
        <label className="grid gap-1">
          Sale date
          <input
            type="date"
            required
            className={field}
            value={saleDate}
            onChange={(event) => {
              setSaleDate(event.target.value)
              setAdded(false)
            }}
          />
        </label>
        <label className="grid gap-1">
          Invoice number
          <input
            required
            className={field}
            value={invoice}
            onChange={(event) => {
              setInvoice(event.target.value)
              setAdded(false)
            }}
          />
        </label>
        <label className="grid gap-1">
          Eligible Product
          <select
            required
            className={field}
            value={product}
            onChange={(event) => {
              setProduct(event.target.value)
              setAdded(false)
            }}
          >
            <option value="">Choose a tire</option>
            {tires.map((tire) => (
              <option key={tire} value={tire}>
                {tire}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          Quantity
          <input
            type="number"
            min="1"
            max="1000"
            required
            className={field}
            value={qty}
            onChange={(event) => {
              setQty(event.target.value)
              setAdded(false)
            }}
          />
        </label>
        <button
          type="submit"
          className={`${button} justify-self-start`}
          disabled={busy !== null || tires.length === 0}
        >
          Add test sale
        </button>
      </form>
      <div className="mt-3 flex items-end gap-2">
        <label className="min-w-0 flex-1 grid gap-1">
          Full PDF path
          <input
            className={field}
            value={pdfPath}
            onChange={(event) => setPdfPath(event.target.value)}
            placeholder="C:\\path\\to\\invoice.pdf"
          />
        </label>
        <button
          type="button"
          className={button}
          disabled={!added || !pdfPath.trim() || busy !== null}
          onClick={() => void upload()}
        >
          Upload invoice PDF
        </button>
      </div>
      {result && (
        <p role="status" className="mt-2 text-muted-foreground">
          {result}
        </p>
      )}
    </details>
  )
}
