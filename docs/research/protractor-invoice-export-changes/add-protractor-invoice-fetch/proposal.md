# 11 · Fetch invoices from Protractor

## Why

About 50 tire sales a month each need an invoice PDF, and today the person opens every invoice in Protractor and
exports it by hand. Protractor does not offer a PDF download: its desktop app builds the PDF itself (the reference
PDF's author is "Protractor.Net Shop Manager"). What the app can get is the invoice data from Protractor's server. A
Fiddler capture shows invoice lookup and detail replies, but the requests inside them have not been decoded yet.

## What Changes

- **Prove it first.** Decode the capture locally, write a cleaned-up reference of the requests and replies (no
  secrets, no customer data), and fetch one real invoice with read-only requests. If this fails, stop and revisit
  changes 11 to 13.
- After a Material Sales export is read and a Protractor login is saved, sign in to Protractor in the background
  and fetch the data for every tire-sale invoice that has no PDF linked.
- Read only: no lock, save or other state-changing request is ever sent to Protractor. This is enforced in code and
  tested, like the ProRewards never-click list.
- Requests are paced, retried a little, and cancelled when the export is replaced or the app closes.
- Fetched data stays in memory for this session only and is never written to disk or the log.

## Capabilities

### New Capabilities

- `protractor-invoices`: signing in to Protractor and fetching invoice data, read-only.

### Modified Capabilities

None. Showing progress and linking PDFs on the Sales screen are in change 12.

## Impact

- New `src/main/protractor/` client (main process only), `docs/protractor-reference.md` (sanitized), private
  decoding notes in `private-data/protractor-data/`.
- **Architecture:** the main process makes HTTPS requests to Protractor's servers. `docs/architecture.md` gets a new
  decision row, security boundary and risk. The user asked for this feature; the decision is recorded, not changed.
- One new dependency is likely: an XML parser for Protractor's replies, chosen in design D3.
- Depends on change 10 (Protractor login).
