# Design

## Context

The sample export is `private-data/sales/material_sales.xlsx` (sheet "Report", 49 rows, columns Invoiced, Invoice
#, Description, Quantity, Supplier; Invoiced is an Excel date-time, Invoice # a number). A real invoice PDF is
`private-data/legacy-fixtures/example_invoice.pdf`. The old invoice reader is
`git show origin/legacy:auto_spiffer/invoices.py`; the old row rules are in `report_parse.py` (`classify_row`).

## Goals / Non-Goals

**Goals:** exact, explainable reading; never a silent drop of a row.

**Non-Goals:** the old PDF report reader (the export replaces it); cross-checking invoice dates and sizes
(the old app's warnings were rarely useful); copying files anywhere.

## Decisions

### D1. Data model (`src/shared/sales.ts`)
```ts
Sale = { row: number; saleDate: string /* yyyy-mm-dd */; invoice: string; description: string; qty: number;
         notATire: null | 'shipping' | 'tube' | 'no-size' }
InvoicePdf = { path: string; name: string; invoice: string | null; fromFileName: boolean; notes: string[]; sha256: string }
SalesState = { file: string; sales: Sale[]; unreadable: {row: number; why: string}[]; month: string /* yyyy-mm */;
               monthWarning?: string; pdfs: InvoicePdf[] }
```
Dates are kept as local calendar dates (no time zones): take year, month and day from the cell.

### D2. Reading the export
ExcelJS, first worksheet that has all four headings in one row (search the first 10 rows). Invoice # from a
number cell is formatted without decimals. A text quantity like "4" is accepted.

### D3. Tire size rules
The size patterns in `docs/matching.md` live in `src/main/matching/sizes.ts` (shared with the matcher, which
comes in change 04). This change needs only `hasTireSize`.

### D4. PDFs
`pdfjs-dist` (legacy build for Node) in a `worker_threads` worker; text of every page joined. Regex
`/Invoice\s*#\s*(\d{3,})/g`, most frequent wins (ties: first seen). File-name fallback `/(?<!\d)(\d{5,7})(?!\d)/`.
SHA-256 of the bytes to spot the same file added twice.

### D5. Fixtures
Committed tests generate a small `.xlsx` with ExcelJS and small PDFs with `pdf-lib` (made-up invoice numbers).
Private tests read the real sample and assert counts only (49 rows, 46 tire rows, 3 not tires).

## Risks / Trade-offs

- Protractor may change the export's headings. Matching by heading text, not position, absorbs reordering; a
  renamed heading gives the plain "column is missing" message.
