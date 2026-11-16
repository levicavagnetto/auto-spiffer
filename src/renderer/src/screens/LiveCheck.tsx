import { useState } from 'react'
import { Button } from '../components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '../components/ui/collapsible'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select'

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

  const field = 'h-8 px-2'
  const label = 'grid gap-1 font-normal'

  return (
    <Collapsible className="shrink-0 border-b border-border px-4 py-2 text-sm">
      <CollapsibleTrigger className="cursor-pointer font-medium outline-none hover:underline focus-visible:outline-2 focus-visible:outline-accent">
        Live check
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="mt-2 text-muted-foreground">
          Test one sale on the live claim page. This check does not submit the
          claim. Remove the test sale and PDF on the website after checking
          them.
        </p>
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void readPage()}
          >
            Read claim page
          </Button>
        </div>
        <form
          onSubmit={(event) => void addSale(event)}
          className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4"
        >
          <Label className={label}>
            Sale date
            <Input
              type="date"
              required
              className={field}
              value={saleDate}
              onChange={(event) => {
                setSaleDate(event.target.value)
                setAdded(false)
              }}
            />
          </Label>
          <Label className={label}>
            Invoice number
            <Input
              required
              className={field}
              value={invoice}
              onChange={(event) => {
                setInvoice(event.target.value)
                setAdded(false)
              }}
            />
          </Label>
          <Label className={label}>
            Eligible Product
            <Select
              required
              value={product || null}
              onValueChange={(value) => {
                setProduct(value ?? '')
                setAdded(false)
              }}
            >
              <SelectTrigger className={field}>
                <SelectValue placeholder="Choose a tire" />
              </SelectTrigger>
              <SelectContent>
                {tires.map((tire) => (
                  <SelectItem key={tire} value={tire}>
                    {tire}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <Label className={label}>
            Quantity
            <Input
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
          </Label>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="justify-self-start"
            disabled={busy !== null || tires.length === 0}
          >
            Add test sale
          </Button>
        </form>
        <div className="mt-3 flex items-end gap-2">
          <Label className={`min-w-0 flex-1 ${label}`}>
            Full PDF path
            <Input
              className={field}
              value={pdfPath}
              onChange={(event) => setPdfPath(event.target.value)}
              placeholder="C:\\path\\to\\invoice.pdf"
            />
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!added || !pdfPath.trim() || busy !== null}
            onClick={() => void upload()}
          >
            Upload invoice PDF
          </Button>
        </div>
        {result && (
          <p role="status" className="mt-2 text-muted-foreground">
            {result}
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
