# Tasks

## 1. Prove one invoice (Phase 0, scripts in private-data only)

- [ ] 1.1 Unpack the capture locally and decode the gzip bodies of sessions 50 to 55; verify the decoded files stay under `private-data/protractor-data/`
- [ ] 1.2 Decode `XmlRequestCompressed` and identify sign-in fields, lookup by invoice number, number to internal ID, detail read, sign-out, and the lock or save operations to block; write `docs/protractor-reference.md` with shapes only (no values, credentials, tenant or customer data)
- [ ] 1.3 Check whether Protractor API 2.0 is available to the shop and returns the same data; record the answer in the reference doc
- [ ] 1.4 If the capture is not enough, ask the user for a narrow new capture (sign in, find one invoice by number, open it, nothing else)
- [ ] 1.5 With the user: fetch the reference invoice (207948) live with read-only requests and the user's login; verify every value on the reference PDF appears in the reply. Stop and report if not

## 2. Client

- [ ] 2.1 Allowed-request list and low-level send (design D2, D4); verify unit tests that blocked operations are never sent
- [ ] 2.2 `fast-xml-parser` plus Zod `InvoiceData` (design D3); verify unit tests against a generated reply with made-up values, and a `*.private.test.ts` against the decoded capture reply that skips when `private-data/` is missing
- [ ] 2.3 Sign-in, find, read and sign-out (design D6); verify unit tests with a fake server for success, refused login, unreachable, not found and two matches

## 3. Fetch queue

- [ ] 3.1 `ProtractorFetcher` wired to export load (design D5); verify unit tests for target selection (linked, wheel and repeated invoices skipped), pacing, retries, cancel on new export, and late results ignored
- [ ] 3.2 Login state updates (change 10); verify a unit test that a refused login is not retried
- [ ] 3.3 Logging review; verify a unit test that log lines contain no invoice data, password or tokens

## 4. Docs and done

- [ ] 4.1 `docs/architecture.md`: decision row, Protractor in the block diagram, security boundary, risk rows
- [ ] 4.2 `openspec validate add-protractor-invoice-fetch --strict`, `npm test`
