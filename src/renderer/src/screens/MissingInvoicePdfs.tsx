import { useState } from 'react'
import { Button } from '../components/ui/button'

export function MissingInvoicePdfs({
  invoices
}: {
  invoices: string[]
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [feedback, setFeedback] = useState('')

  const copyInvoice = async (invoice: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(invoice)
      setFeedback(`Copied invoice ${invoice}.`)
    } catch {
      setFeedback(
        `Could not copy invoice ${invoice}. Select the number and copy it.`
      )
    }
  }

  return (
    <section
      className="mt-4 rounded-lg bg-warning p-4 text-sm text-warning-foreground"
      aria-label="Missing invoice PDFs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {invoices.length} invoice{invoices.length === 1 ? '' : 's'} need
            {invoices.length === 1 ? 's' : ''} a PDF
          </p>
          <p className="mt-1">
            These sales will still be entered. Add the PDFs here, or upload them
            on ProRewards yourself.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-warning-foreground/40 text-warning-foreground hover:bg-warning-foreground/10 hover:text-warning-foreground"
          aria-expanded={expanded}
          aria-controls="missing-invoice-list"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Hide invoices ▴' : 'Show invoices ▾'}
        </Button>
      </div>
      {expanded && (
        <div
          id="missing-invoice-list"
          className="mt-4 border-t border-warning-foreground/30 pt-4"
        >
          <p className="mb-3 text-xs">Click an invoice number to copy it.</p>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {invoices.map((invoice) => (
              <Button
                key={invoice}
                variant="outline"
                size="sm"
                className="border-warning-foreground/40 font-mono text-warning-foreground hover:bg-warning-foreground/10 hover:text-warning-foreground"
                aria-label={`Copy invoice ${invoice}`}
                onClick={() => void copyInvoice(invoice)}
              >
                {invoice}
              </Button>
            ))}
          </div>
          <p role="status" className="mt-3 min-h-4 text-xs">
            {feedback}
          </p>
        </div>
      )}
    </section>
  )
}
