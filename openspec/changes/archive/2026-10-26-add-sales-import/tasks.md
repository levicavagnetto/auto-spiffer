# Tasks

## 1. Sales export

- [x] 1.1 Shared types (design D1) and the size patterns with `hasTireSize` (`docs/matching.md` section 2); verify unit tests for every size shape listed there and for words that must not count as sizes
- [x] 1.2 The xlsx reader by headings (design D2) with unreadable-row reporting; verify committed tests with generated workbooks (reordered columns, extra columns, a missing heading, a text quantity, an empty row, a bad row) and a private test on the real sample (49 rows)
- [x] 1.3 Not-a-tire rules and the month rule; verify tests for shipping, handling, tube, no size, one month, and two months

## 2. Invoice PDFs

- [x] 2.1 The PDF reader in a worker thread (design D4); verify committed tests with generated PDFs (number inside, number only in the name, disagreement, none, a non-PDF) and a private test on `example_invoice.pdf`
- [x] 2.2 Linking and the summary (linked, sales without a PDF, PDFs not in the sales, invoices with two PDFs, the same file twice); verify unit tests for each

## 3. Sales screen

- [x] 3.1 IPC calls to pick an export, pick PDFs or a folder, accept dropped paths, and remove PDFs; verify that dropped paths are validated in main (existence, extension) with unit tests
- [x] 3.2 The Sales screen from `docs/ui.md` (empty state, export card, PDFs card with drop zone and warnings, Match tires enabled once an export is read; the ProRewards card shows "Not signed in" for now); the sidebar month card fills in; Review becomes enabled after Match tires (it shows a placeholder until change 04); verify e2e tests with the committed fixtures

## Workflow follow-up

- Run `openspec validate add-sales-import --strict` and `npm run check`, then archive.
