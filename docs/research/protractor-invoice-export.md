# Protractor bulk invoice export: research notes (shelved)

**Status:** explored 2026-10-30 to 2026-11-02. Not being built yet. If resumed, the chosen direction is
**desktop UI automation of the running Protractor app on a hidden Windows desktop** (see below). This doc is the
single source of truth; the four OpenSpec changes drafted during this exploration are superseded (see the last
section).

## Goal

The shop exports an invoice PDF by hand for every tire sale (Protractor: Find by number, open, Export to PDF).
We want Auto Spiffer to produce one genuine Protractor PDF per invoice number in bulk, with no per-invoice
clicking. The natural input is the list of tire sales with no linked PDF that the Sales screen already shows.

## What Protractor is

- A desktop **.NET app** ("Protractor.Net Shop Manager", client version seen in traffic was `1.0.26.x`). The shop
  reports it is low quality and unlikely to expose clean accessibility (UI Automation) hooks.
- It talks to `sm1.protractor.com` (sessions, login, application calls) and `ds1.protractor.com` (a data cache
  sync). The main call is `POST /1.0/{tenant}/APIGen1/Execute`: a gzip JSON envelope that wraps a gzip XML body
  (`XmlRequestCompressed`); replies are gzip XML (`ProtractorAPIReply`).

## What the network capture showed

A Fiddler capture of a normal session was decoded locally (private, see last section). Findings:

- **Auth is per request.** Every call carries three headers: an `apikey` (constant, baked into the client), an
  `authentication` token (constant), and a `sessionid`. The session is created by `Session/New` (which sends a
  fingerprint of the machine) and then `Security/Login`, which sends the domain, username, and a 128-hex
  `PasswordHash`. The hashing scheme is salted/iterated and was not reproduced, and reproducing it by guessing is
  off the table.
- **Invoice reads are clean and read-only.** `WorkOrderReadBySearchCriteria` (a search; the capture searched by
  customer name) and `WorkOrderReadByID` (the full invoice: customer, vehicle, line items, totals, tax, payment,
  signature). Opening an invoice in the app also sends `POST /Lock`; automation must never trigger that.
- **Some of what the PDF prints is not sent per invoice.** The client caches several lists locally and only
  re-downloads them when they change: `Employees` (turns advisor/tech IDs into names like "ZachN"),
  `ImageRecords` (likely the header banner and QR code), `DocumentDesigners` (likely the invoice layout), and shop
  configuration. During the capture nothing had changed, so these never crossed the wire.
- **The server never returns a PDF.** No response was `application/pdf` or began with `%PDF`. The desktop client
  renders the invoice PDF itself. This is the decisive fact.

## Reference PDFs analyzed

`private-data/real-invoices/Invoice-207948-Invoice.pdf` (2 pages) and `Invoice-214939-Invoice.pdf` (1 page).
Metadata author is "Protractor.Net Shop Manager". US Letter; fonts are the Arial family plus Segoe UI Semibold
(all stock Windows fonts); images are the header banner (logo, shop name and address, ASE and SEMA badges), a
road-side-assistance QR code, and the signature. A per-run positional dump of every text item is in
`private-data/real-invoices/analysis/`. Cross-checking invoice 214939 against the decoded data confirmed every
customer, vehicle, line, price, total, tax and payment value is present in `WorkOrderReadByID`; only the cached
items above (names, images, fixed footer text) are not.

## Approaches considered

1. **Call the servers and rebuild the PDF from data. Rejected.**
   - Needs either the login password hash (not reproducible without decompiling the client) or borrowing the
     running app's live session (would mean reading another process's memory or proxying all its traffic, both
     fragile and invasive).
   - It also means posing as the desktop client on the wire, which is likely against Protractor's terms. We asked
     Protractor about official API 2.0 access and got no response.
   - Even if solved, the server returns no PDF, so we would still have to rebuild each PDF from data and
     re-source the cached names and images. Fidelity work with no upside over option 3.

2. **Protractor's own Batch Print Invoice / folder export.** A real fallback, but it exports per customer, not from
   an arbitrary list of invoice numbers.

3. **Automate the running desktop app. Chosen direction.** Only way to get the genuine exported PDF, and it
   sidesteps authentication entirely.

## Chosen direction if resumed: drive the running app

- **No authentication problem.** Protractor is already open and signed in by the user. We do not make requests; we
  operate the window the user already logged into. The password-hash blocker disappears. Precondition: the app is
  running and signed in; if not, Auto Spiffer asks the user to sign in and never touches their credentials.
- **Genuine PDFs, no rebuilding.** For each invoice number: Find by number, open, Export to PDF, save the file.
  Auto Spiffer then links and uploads those PDFs as it does today, and deletes them after a confirmed upload.
- **Keep it off the user's screen.** The shop finds it distracting and ugly to watch the app move around. Launch or
  park Protractor on a **hidden Windows desktop** (`CreateDesktop`) or off-screen. Auto Spiffer shows its own clean
  progress ("Exporting 12 of 50"); optionally stream a thumbnail if the user wants to watch.
- **Drive it the universal way.** Because the app exposes no good automation hooks, recognize fields and buttons by
  how they look (image matching) and send simulated input, verifying after each step and stopping safely on
  anything unexpected (never clicking blindly forward). Tradeoffs: brittle to layout changes, DPI, and unexpected
  pop-ups; slower, a few seconds per invoice, which is fine for ~50 a month in the background.

## Open questions before building

- How is Protractor launched on the shop PC: an installed `.exe`, or a Citrix / remote-desktop session? This
  decides whether the hidden-desktop trick works.
- Does Export to PDF allow a default save folder, or does it pop a Save dialog every time?
- How stable is image matching across Protractor updates and different screen DPI?
- Which Windows automation tooling fits the Electron stack for image matching, simulated input, and the hidden
  desktop? To be evaluated.

## Private material (gitignored, never commit)

All of this holds real customer, dealer and tenant data and lives only under `private-data/`:

- `private-data/protractor-data/capture.saz`, its `unpacked/`, `decoded/`, and `findings.md`: the Fiddler analysis.
- `private-data/protractor-data/scripts/`: local decode helpers (`list.mjs`, `shape.mjs`, `xmlreq.mjs`, `resp.mjs`,
  `auth.mjs`).
- `private-data/real-invoices/*.pdf` and `private-data/real-invoices/analysis/`: reference PDFs and layout dumps.

## Status of the drafted OpenSpec changes

The four changes `add-protractor-login`, `add-protractor-invoice-fetch`, `generate-invoice-pdfs` and
`clean-up-generated-pdfs` were drafted for the rejected network-plus-rebuild approach. They are superseded by this
doc. When work resumes, remove or rewrite them: a desktop-automation proposal needs no Protractor login card (the
user signs in to Protractor itself) and no PDF generation (we get the genuine exported PDF). The cleanup change
(delete PDFs after upload) still applies in spirit.
