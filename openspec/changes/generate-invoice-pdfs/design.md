# Design

## Context

The reference invoice (`private-data/real-invoices/Invoice-207948-Invoice.pdf`) is PDF 1.4, 2 pages of 612 × 792 pt,
4 embedded fonts (subset names hidden by pdf.js), 2 images, about 120 text runs on page 1, author "Protractor.Net Shop
Manager (1.0.26.19220)", title "Invoice 207948". Change 11 delivers a validated `InvoiceData` per invoice in memory.
`SalesSession` holds `pdfs: InvoicePdf[]`; `linkSales` links the first PDF per invoice; claim entry uploads
`usedByInvoice[invoice]`.

## Goals / Non-Goals

**Goals:** a template that matches the reference closely enough that the person cannot tell them apart in normal
viewing; exact text; made PDFs that flow through linking and upload unchanged.

**Non-Goals:** a byte-identical file (needs Protractor's own PDF engine); other Protractor documents (estimates,
work orders); a setting to customize the layout.

## Decisions

### D1. Measure the reference first

A private script uses pdfjs-dist to dump every text run (font, size, x, y, width), line, rectangle and image
position from the reference, and extracts the embedded fonts and images. The template is built from these
measurements, in points, not by eye. Results stay in `private-data/real-invoices/analysis/`.

### D2. HTML template, Electron `printToPDF`

The template is a typed function `renderInvoiceHtml(data: InvoiceData): string` that escapes every value and lays
out with absolute positions in `pt` and CSS paged media for page breaks. A hidden, sandboxed `BrowserWindow` with no
preload loads it from a `data:` URL with JavaScript off and saves it with `webContents.printToPDF({ pageSize:
'Letter', margins: none, printBackground: true })`. One window is reused per batch.

Alternative: `pdf-lib` or `pdfkit` drawing at exact coordinates. Kept as plan B if Chromium's text layout cannot
match line wrapping or font metrics within tolerance (task 2.4 decides).

### D3. Fonts and logo

Use the same font families as the reference. If they are standard Windows fonts (likely Arial or Tahoma), load them
from the system with `local()`; never ship Microsoft font files. The logo and any fixed images come from Protractor
data if the reply includes them; otherwise from the shop's logo the person picks once in Settings (stored in app
data). Task 1.2 decides.

### D4. Honest metadata

Title is "Invoice N" as in Protractor's export. The producer stays Chromium's, so a made PDF is identifiable as made
by Auto Spiffer in its file properties, without any visible mark.

### D5. Fidelity check

A `*.private.test.ts` renders invoice 207948 from the decoded capture data and compares (a) normalized text of each
page for exact equality and (b) each page rasterized at 150 dpi with pdf.js in an Electron window, against the
reference, allowing a small pixel difference for antialiasing. A committed test does the same against a made-up
invoice and a committed snapshot of its own output to catch regressions.

### D6. Linking

`InvoicePdf` gets `source: 'picked' | 'protractor'`. Made PDFs are appended to `SalesSession.pdfs` after the
fetcher's result for that invoice, only if the invoice still has no picked PDF. `linkSales` prefers `picked` over
`protractor` for the same invoice and drops the made one from the duplicate list. The renderer receives fetch
progress and per-invoice reasons through the existing snapshot plus a `protractor` field.

### D7. Folder

`app.getPath('temp')/Auto Spiffer/invoices/<session id>/<invoice>.pdf`. A new folder per export load avoids name
clashes between exports. Change 13 deletes these files.

## Risks / Trade-offs

- [Chromium cannot match Protractor's text layout exactly] → Plan B in D2; picture tolerance agreed with the user in
  task 2.4.
- [Protractor has several invoice templates or shop settings] → Task 3.1 tests other invoice shapes from the user;
  unknown layouts mark the invoice "Could not build this invoice's PDF".
- [ProRewards may reject a made PDF] → The user checks one upload on the live site in task 4.1 before release.

## Migration Plan

None.

## Open Questions

- Which fonts and images does the reference use, and does Protractor's data include the logo? (task 1.2)
- What picture tolerance is close enough? (task 2.4, with the user)
