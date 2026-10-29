import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileSpreadsheet, FolderOpen, UploadCloud } from 'lucide-react'
import { Button } from '../components/ui/button'
import { MissingInvoicePdfs } from './MissingInvoicePdfs'
import type { SalesSnapshot } from '../../../shared/sales'

function dateLabel(day: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${day}T00:00:00Z`))
}

function exportError(error: unknown): string {
  const detail = error instanceof Error ? error.message : ''
  return (
    detail.match(
      /This file does not look like a Material Sales export: the .+ column is missing\./
    )?.[0] ??
    detail.match(/This file could not be read as an Excel workbook\./)?.[0] ??
    'Could not read the sales export. Choose an Excel file and try again.'
  )
}

export function Sales({
  snapshot,
  headerActions,
  onSnapshot,
  onMatch
}: {
  snapshot: SalesSnapshot | null
  headerActions?: HTMLElement | null
  onSnapshot: (next: SalesSnapshot, newExport: boolean) => void
  onMatch: () => Promise<void>
}): React.JSX.Element {
  const exportInput = useRef<HTMLInputElement>(null)
  const pdfInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadExport = async (path: string): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      onSnapshot(await window.api.loadSalesExport(path), true)
    } catch (problem) {
      setError(exportError(problem))
    } finally {
      setBusy(false)
    }
  }

  const addPaths = async (paths: string[]): Promise<void> => {
    if (!paths.length) return
    setBusy(true)
    setError('')
    try {
      onSnapshot(await window.api.addInvoicePaths(paths), false)
    } catch {
      setError('Could not add these PDFs. Check the files and try again.')
    } finally {
      setBusy(false)
    }
  }

  const exportFiles = (files: FileList | null): void => {
    if (!files?.length) return
    const path = window.api.getPathForFile(files[0]!)
    if (path) void loadExport(path)
    else setError('Could not find that file. Choose it again.')
  }

  const pdfFiles = (files: FileList | null): void => {
    if (files?.length)
      void addPaths(Array.from(files).map(window.api.getPathForFile))
  }

  const addFolder = async (): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      const next = await window.api.pickInvoiceFolder()
      if (next) onSnapshot(next, false)
    } catch {
      setError('Could not read that folder. Choose it again.')
    } finally {
      setBusy(false)
    }
  }

  const removePdf = async (path: string): Promise<void> => {
    setBusy(true)
    try {
      onSnapshot(await window.api.removeInvoicePdf(path), false)
    } catch {
      setError('Could not remove this PDF. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const match = async (): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      await onMatch()
    } catch (problem) {
      const detail = problem instanceof Error ? problem.message : ''
      setError(
        detail.match(
          /Open the claim page for .+ in the ProRewards tab first\./
        )?.[0] ??
          'Could not read the claim page. Open it in ProRewards and try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  const sales = snapshot?.state.sales ?? []
  const dates = sales.map((sale) => sale.saleDate).sort()
  const tireCount = sales.filter((sale) => !sale.notATire).length
  const tubeCount = sales.filter((sale) => sale.notATire === 'tube').length
  const shippingCount = sales.filter(
    (sale) => sale.notATire === 'shipping'
  ).length
  const noSizeCount = sales.filter((sale) => sale.notATire === 'no-size').length
  const wheelCount = sales.filter((sale) => sale.notATire === 'wheel').length
  const excluded = tubeCount + shippingCount + noSizeCount + wheelCount
  const reasons = [
    tubeCount ? `${tubeCount} tube${tubeCount === 1 ? '' : 's'}` : '',
    shippingCount ? `${shippingCount} shipping or handling` : '',
    noSizeCount ? `${noSizeCount} with no tire size` : '',
    wheelCount
      ? `${wheelCount} possible wheel${wheelCount === 1 ? '' : 's'}`
      : ''
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="space-y-5">
      {headerActions &&
        createPortal(
          <Button disabled={!snapshot || busy} onClick={() => void match()}>
            Match tires
          </Button>,
          headerActions
        )}
      <input
        ref={exportInput}
        aria-label="Choose Material Sales export"
        type="file"
        accept=".xlsx"
        className="sr-only"
        onChange={(event) => {
          exportFiles(event.currentTarget.files)
          event.currentTarget.value = ''
        }}
      />
      <input
        ref={pdfInput}
        aria-label="Add invoice PDFs"
        type="file"
        accept=".pdf"
        multiple
        className="sr-only"
        onChange={(event) => {
          pdfFiles(event.currentTarget.files)
          event.currentTarget.value = ''
        }}
      />
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive p-3 text-sm text-destructive-foreground"
        >
          {error}
        </p>
      )}
      {!snapshot ? (
        <>
          <section
            aria-label="Sales export drop zone"
            className="flex min-h-72 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-8 text-center"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              exportFiles(event.dataTransfer.files)
            }}
          >
            <FileSpreadsheet
              className="mb-4 size-9 text-accent"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold">Material Sales export</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No sales loaded yet.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Drop the month&apos;s Excel export here, or choose a file.
            </p>
            <Button
              className="mt-5"
              disabled={busy}
              onClick={() => exportInput.current?.click()}
            >
              Choose Excel file
            </Button>
          </section>
        </>
      ) : (
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Material Sales export</h2>
                <p className="mt-1 break-all text-sm text-muted-foreground">
                  {snapshot.state.file.split(/[\\/]/).at(-1)}
                </p>
                {dates.length > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sales from {dateLabel(dates[0]!)} to{' '}
                    {dateLabel(dates.at(-1)!)}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => exportInput.current?.click()}
              >
                Replace
              </Button>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span>{sales.length} rows</span>
              <span>
                {tireCount} tire line{tireCount === 1 ? '' : 's'}
              </span>
              <span>
                {excluded} left out{reasons ? `: ${reasons}` : ''}
              </span>
            </div>
            {snapshot.state.monthWarning && (
              <p className="mt-4 rounded-lg bg-warning p-3 text-sm text-warning-foreground">
                {snapshot.state.monthWarning}
              </p>
            )}
            {snapshot.state.unreadable.length > 0 && (
              <div className="mt-4 rounded-lg bg-warning p-3 text-sm text-warning-foreground">
                <p className="font-medium">Rows that could not be read</p>
                <ul className="mt-1 list-inside list-disc">
                  {snapshot.state.unreadable.map((item) => (
                    <li key={item.row}>
                      Row {item.row}: {item.why}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Invoice PDFs</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {snapshot.links.loadedCount} PDF
                  {snapshot.links.loadedCount === 1 ? '' : 's'} loaded ·{' '}
                  {snapshot.links.linkedCount} linked to a sale
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => pdfInput.current?.click()}
                >
                  Add PDFs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void addFolder()}
                >
                  <FolderOpen className="size-4" /> Add folder
                </Button>
              </div>
            </div>
            <div
              aria-label="Invoice PDF drop zone"
              className="mt-4 rounded-lg border-2 border-dashed border-border p-5 text-center text-sm text-muted-foreground"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                pdfFiles(event.dataTransfer.files)
              }}
            >
              <UploadCloud className="mx-auto mb-2 size-5" aria-hidden="true" />
              Drop more PDFs or a folder here
            </div>
            {snapshot.state.pdfs.length > 0 && (
              <ul className="mt-4 max-h-32 overflow-auto text-sm">
                {snapshot.state.pdfs.map((pdf) => (
                  <li
                    key={pdf.path}
                    className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                  >
                    <span className="min-w-0 truncate" title={pdf.path}>
                      {pdf.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      aria-label={`Remove ${pdf.name}`}
                      onClick={() => void removePdf(pdf.path)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {snapshot.state.pdfs.some((pdf) =>
              pdf.notes.some((note) => note.startsWith('The file name says'))
            ) && (
              <ul className="mt-3 list-inside list-disc text-sm text-warning-foreground">
                {snapshot.state.pdfs.flatMap((pdf) =>
                  pdf.notes
                    .filter((note) => note.startsWith('The file name says'))
                    .map((note) => (
                      <li key={`${pdf.path}-${note}`}>
                        {pdf.name}: {note}
                      </li>
                    ))
                )}
              </ul>
            )}
            {snapshot.links.missingInvoices.length > 0 && (
              <MissingInvoicePdfs invoices={snapshot.links.missingInvoices} />
            )}
            {snapshot.links.extraPdfs.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Not in this month&apos;s sales:{' '}
                {snapshot.links.extraPdfs.map((pdf) => pdf.name).join(', ')}.
                These PDFs will be ignored.
              </p>
            )}
            {snapshot.links.unlinkedPdfs.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                No invoice number found in:{' '}
                {snapshot.links.unlinkedPdfs.map((pdf) => pdf.name).join(', ')}.
              </p>
            )}
            {snapshot.links.unreadablePdfs.length > 0 && (
              <p className="mt-3 text-sm text-warning-foreground">
                Could not read these PDFs:{' '}
                {snapshot.links.unreadablePdfs
                  .map((pdf) => pdf.name)
                  .join(', ')}
                .
              </p>
            )}
            {snapshot.links.duplicateInvoices.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                More than one PDF for invoice{' '}
                {snapshot.links.duplicateInvoices
                  .map((item) => item.invoice)
                  .join(', ')}
                . The first is used.
              </p>
            )}
            {snapshot.links.identicalCopies.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Identical copies ignored:{' '}
                {snapshot.links.identicalCopies
                  .map((pdf) => pdf.name)
                  .join(', ')}
                .
              </p>
            )}
            {snapshot.warnings.length > 0 && (
              <ul className="mt-3 list-inside list-disc text-sm text-warning-foreground">
                {snapshot.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
