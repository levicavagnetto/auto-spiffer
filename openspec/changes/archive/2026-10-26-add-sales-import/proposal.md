# 03 · Sales and invoice import

## Why

Each month starts with two inputs: the Material Sales export from Protractor (`.xlsx`) and the month's invoice
PDFs. The app must read them reliably, tell the person plainly what it found, and link each sale to its PDF by
the invoice number printed inside the PDF.

## What Changes

- Read `material_sales.xlsx`: one sale per row (Invoiced date, Invoice #, Description, Quantity), ignoring the
  Supplier column and any other columns; mark rows that are not tires (shipping, handling, tubes, no tire
  size).
- Work out the month from the sale dates.
- Read invoice PDFs (picked as files or a folder, or dropped): find the invoice number inside each, link it to
  the month's sales, and report sales without a PDF and PDFs for invoices not in the sales.
- The **Sales** screen from `docs/ui.md` (except the ProRewards card's live data, which sign-in fills later).

## Capabilities

### New Capabilities
- `sales-import`: reading the sales export and invoice PDFs, and the Sales screen.

### Modified Capabilities
- None.

## Impact

- `src/main/sales/` (xlsx reader, row rules, month), `src/main/invoices/` (PDF reader in a worker thread,
  linking), the Sales screen, IPC calls for picking files.
- Files are read where they are; nothing is copied or kept between sessions.
- Depends on `add-app-shell`.
