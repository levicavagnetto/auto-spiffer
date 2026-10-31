# Tasks

## 1. Measure the reference

- [ ] 1.1 Dump the reference PDF's text runs, lines, boxes and images with positions (design D1); verify the output stays in `private-data/real-invoices/analysis/`
- [ ] 1.2 Identify its fonts and images and where the logo comes from (design D3); record the answer in this design
- [ ] 1.3 Map every printed value on the reference to an `InvoiceData` field or fixed template text; list anything with no source and resolve it with the user before task 2

## 2. Template and renderer

- [ ] 2.1 `renderInvoiceHtml` with escaping and page breaks (design D2); verify unit tests that values are escaped and a made-up invoice produces the expected sections
- [ ] 2.2 Hidden-window `printToPDF` renderer (design D2, D4); verify a test that output is US Letter, has the expected page count, and contains "Invoice # N" that the app's reader finds
- [ ] 2.3 Missing-field check; verify a unit test that an invoice without totals makes no PDF
- [ ] 2.4 Fidelity check against the reference (design D5); with the user, agree the picture tolerance and decide whether plan B is needed

## 3. Other invoice shapes

- [ ] 3.1 Ask the user for 3 to 5 more reference PDFs (multiple pages, discounts, fees, credits, signatures); verify each passes the fidelity check, or record what differs and fix it

## 4. Sales screen

- [ ] 4.1 `source` on `InvoicePdf`, linking preference and temp folder (design D6, D7); verify unit tests for picked over made, made dropped when a picked one arrives, and no made PDF for an invoice that gained a picked one
- [ ] 4.2 Progress line, From Protractor mark and missing-list reasons; verify a Playwright e2e test with a fake Protractor client and made-up invoices
- [ ] 4.3 Update `docs/ui.md`

## 5. Live check and done

- [ ] 5.1 With the user: load a real month, confirm made PDFs look right, and upload one to ProRewards to confirm it is accepted. Record results in `notes.md`
- [ ] 5.2 `openspec validate generate-invoice-pdfs --strict`, `npm test`, `npm run test:e2e`
