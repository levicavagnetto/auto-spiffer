# 12 · Make invoice PDFs

## Why

Change 11 gets each missing invoice's data from Protractor. Protractor's desktop app builds invoice PDFs itself, so
Auto Spiffer has to build them too, and they must look like the PDFs the person exports today
(`private-data/real-invoices/Invoice-207948-Invoice.pdf`: 2 US Letter pages, 4 embedded fonts, 2 images). The made
PDFs then go into the Invoice PDFs section as if the person had picked them, so claim entry uploads them with no
other changes.

## What Changes

- An invoice template that reproduces Protractor's invoice layout: page size, margins, fonts, logo, header,
  customer and vehicle blocks, line table, totals, footer, signatures and page breaks.
- Every value printed comes from Protractor's data as given. Nothing is recalculated.
- A made PDF is checked against the reference invoice page by page (picture) and value by value (text) before the
  feature ships.
- Each fetched invoice becomes a PDF in a temporary app folder and is linked to its sales on the Sales screen,
  marked **From Protractor**. The person can remove it like any other PDF.
- The Sales screen shows progress ("Getting 12 invoices from Protractor, 5 done") and, for invoices that could not
  be made, the reason next to the invoice number on the missing-PDF list.
- A PDF the person picks always wins over a made one for the same invoice.

## Capabilities

### New Capabilities

- `invoice-pdf-generation`: building an invoice PDF from Protractor data that matches Protractor's own layout.

### Modified Capabilities

- `sales-import`: made PDFs are linked like picked ones; the Sales screen shows fetch progress, the From Protractor
  mark and reasons on the missing list.

## Impact

- `src/main/protractor/render/` (template and renderer), `SalesSession` and `linkSales`, the Sales screen PDF
  section, `docs/ui.md`.
- Uses Electron's built-in `printToPDF`; no PDF library unless the fidelity check proves one is needed (design D2).
- Depends on change 11.
