# Design

## Context

`docs/site-reference.md` has every selector, the page scripts that worked in the old app, the outcome rules for
Add, and the never-click list. `docs/architecture.md` explains why the tab is driven in process. The old
implementation is `git show origin/legacy:auto_spiffer/fill.py` (Playwright, Python) and
`origin/legacy:auto_spiffer/page_stub.py` (the test stub).

## Goals / Non-Goals

**Goals:** prove in-process driving on the saved page and on the live site; a small driver API that the claim
entry and sign-in changes build on.

**Non-Goals:** signing in, choosing the program, the run loop, pause and stop (later changes).

## Decisions

### D1. The view
One `WebContentsView` created by the main process with `partition: 'persist:prorewards'`, `sandbox: true`,
`contextIsolation: true`, no preload. The main process sets its bounds from layout messages the renderer sends
(the rectangle of the placeholder element where the tab should appear) and hides it when another screen is
shown. `setWindowOpenHandler` and `will-navigate` send off-site links to `shell.openExternal`.

### D2. Talking to the page
- Reading and filling: `webContents.executeJavaScript` with the scripts from `docs/site-reference.md`, passing
  arguments as JSON (never by building script text from data without `JSON.stringify`).
- Clicking: in-page `element.click()` on an element found by selector, through `guardedClick(selector)`, which
  first checks the never-click list and the Next/Submit text rule.
- Uploading: `webContents.debugger.attach('1.3')` once per page load; `Runtime.evaluate` returns the last file
  input as an object id; `DOM.setFileInputFiles({ objectId, files: [path] })`.
- Waiting: a `waitFor(predicate, { timeoutMs, intervalMs: 50 })` helper over `executeJavaScript`, plus the
  ASP.NET request counter. Navigation in the middle of a check counts as "not yet", not as an error.

### D3. Driver API (main process)
```ts
isClaimPage(): Promise<boolean>
readPage(): Promise<{ promotion: string|null; window: [Date|null, Date|null]; tires: string[]; lines: SiteLine[] }>
addLine(line: { saleDate: Date; invoice: string; product: string; qty: number }): Promise<AddOutcome>
upload(pdfPath: string): Promise<void>        // throws a plain-language error on failure
screenshot(name: string): Promise<string>     // returns the file path
```
`AddOutcome = { kind: 'added'|'duplicate'|'rejected'|'mismatch'|'timeout'; message?: string; timing: {...} }`.
Fill directly first; if the boxes do not show the line, type it (focus, select all, insert text, Tab) and
check again. Log timings per line as the old app did.

### D4. Test harness
`tests/e2e/site/*.private.test.ts` load `private-data/site-pages/ATD ProRewards - Submit Claim.htm` into the
tab with `session.webRequest.onBeforeRequest` cancelling everything that is not `file:`, then inject a
TypeScript port of the legacy stub (Add appends a grid row or shows a popup; uploads succeed; every click is
recorded). They skip when `private-data/` is missing. A committed, trimmed fixture page (no dealer name, ids or
ViewState; a 6-option dropdown; the same control ids) is made for the CI-safe tests.

Playwright's Electron launcher adds `--remote-debugging-port=0` to run its tests. Verify that uploads work in
the Playwright test, then check the absence of a remote debugging switch in a separate normal Electron launch.
The normal launch is the one that proves the app itself opens no debugging port.

For the user-run live proof, show a collapsible check form above the site tab only in development. It reads the
current claim page's tire labels, accepts one sale and an invoice PDF path, calls the same main-process driver,
and reports the Add result and timings before enabling Upload. The form retains no sale data after it closes.
The IPC handlers for Add and Upload reject calls in a packaged app. This check form is removed when the normal
claim-entry flow is built.

### D5. Plan B
If uploads or filling cannot be made to work in the view, the same `SiteDriver` interface is implemented with
Playwright for Node launching Edge (`channel: 'msedge'`), as the old app did. Ask the user first: it brings back
a separate browser window.

## Risks / Trade-offs

- `DOM.setFileInputFiles` on the Telerik RadAsyncUpload input is the main unknown. The saved page cannot prove
  the upload reaches the server; only the live check (task 4.1) can.
- The debugger attachment shows nothing to the person, but a second attach fails; keep one per page load and
  re-attach after navigation.
