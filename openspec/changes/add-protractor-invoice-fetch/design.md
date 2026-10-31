# Design

## Context

Known from the capture (`private-data/protractor-data/capture.saz`, sensitive, never committed or replayed):

- Hosts `sm1.protractor.com` (sessions, login, application requests) and `ds1.protractor.com` (DataStore).
- Requests go to `POST https://sm1.protractor.com/1.0/{tenant}/APIGen1/Execute` with gzip JSON bodies:
  `ID`, `Version`, `ClientTimeZoneID`, `ClientUTCOffset`, `Name`, `Parameters`, `XmlRequestCompressed`. The nested
  `XmlRequestCompressed` is **not decoded yet**.
- Replies are gzip XML: `ProtractorAPIReply` with errors and datasets.
- Sessions 50 to 52 look like invoice searches (52 returns WorkOrders with InvoiceNumber and internal IDs); session
  55 looks like full invoice detail; 57 to 72 are supporting data. Some routes create or remove locks and sessions.
- No PDF was returned by the server.

In the app, `SalesSession` (`src/main/sales/session.ts`) holds the export and PDFs and `linkSales` produces
`missingInvoices` (tire invoices only).

## Goals / Non-Goals

**Goals:** prove one read-only fetch; a main-process client that signs in, looks up and reads invoices; a fetch
queue tied to the current export; outcomes per invoice.

**Non-Goals:** rendering PDFs or changing the Sales screen (change 12); Protractor's public API 2.0 unless the
decoding shows it is available to the shop and easier (checked in task 1.3); writing anything to Protractor.

## Decisions

### D1. Prove before building (Phase 0)

Decoding and a single live read-only fetch come first and are throwaway scripts under `private-data/` (gitignored).
Outputs: `docs/protractor-reference.md` with sanitized request and reply shapes (field names and types, no values,
tenant shown as `{tenant}`), and private notes. If a read-only path is not found, stop and report before task 2.

### D2. Client in the main process, Node `fetch` and `zlib`

`src/main/protractor/client.ts` uses Node's `fetch` and `zlib` (gunzip and whatever `XmlRequestCompressed`
turns out to use). The renderer never sees tokens, request bodies or replies. Requests carry a plain user agent
naming Auto Spiffer only if the decoding shows the server does not require the desktop client's.

### D3. XML parsing and validation

Parse replies with `fast-xml-parser` (small, no native code, TypeScript types), then validate the parts we use with
Zod into an `InvoiceData` type: header (invoice number, dates), shop, customer, vehicle, lines, totals, taxes, fees,
payments and any notes or signatures that appear on the reference PDF. Fields are kept as Protractor's text and
values; nothing is recalculated. A reply that fails validation marks that invoice failed and logs the field path,
never the value.

Alternative: write a tiny XML reader. Rejected; the replies are large datasets and a tested parser is safer.

### D4. Allowed-request list

The client exposes only `signIn`, `findInvoice(number)`, `readInvoice(id)` and `signOut`. Each maps to a named
operation on an allow list in `src/main/protractor/allowed.ts`; the low-level send refuses anything else. A unit
test feeds every lock or save operation name seen in the capture and checks it is refused.

### D5. Fetch queue

`ProtractorFetcher` owns one `AbortController` per export. When `SalesSession` loads an export it computes the
targets from `linkSales(...).missingInvoices`, then runs at most 2 requests at a time with a short delay, up to 2
retries per invoice with backoff, and re-checks before each invoice that it still has no linked PDF. Outcomes:
`fetched | not-found | ambiguous | failed | login-refused | unreachable`. Results are stored on the session in
memory and emitted as events for change 12.

### D6. Sign-in and session end

Sign in once per export run, sign out when the queue finishes or is cancelled, and never retry a refused login.
Updates the login state from change 10.

## Risks / Trade-offs

- [Internal endpoints can change without notice] → All shapes are behind Zod; a change shows "Could not get this
  invoice from Protractor" and the person adds the PDF by hand as today. The reference doc records the client
  version seen in the capture (1.0.26.19220).
- [Terms of use for automated access] → The person uses their own authorized login, read-only, at a slow pace. Note
  in the reference doc that a public API would be preferred if it becomes available.
- [Invoice numbers may not be unique across locations] → Ambiguous results are never used (spec).
- [Capture may not hold enough to sign in] → Task 1.4 makes a new, narrow capture with the person.

## Migration Plan

None. The feature is off until a Protractor login is saved.

## Open Questions

- How is `XmlRequestCompressed` encoded, and which operation names do lookup and detail use?
- Does the shop have API 2.0 access, and does it return the same data?
