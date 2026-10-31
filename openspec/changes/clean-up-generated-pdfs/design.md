# Design

## Context

Change 12 writes made PDFs to `app.getPath('temp')/Auto Spiffer/invoices/<session id>/` and adds them to
`SalesSession.pdfs` with `source: 'protractor'`. The runner (`src/main/run/runner.ts`) uploads an invoice's PDF
once when at least one of its lines was added in this run, and checks the upload appeared on the page.

## Goals / Non-Goals

**Goals:** no made invoice left on disk after it is uploaded or the session ends; never touch the person's files.

**Non-Goals:** remembering uploads between sessions (no month memory); deleting picked PDFs.

## Decisions

### D1. Delete only after a confirmed upload

The runner already confirms the upload on the page. On confirmation, if the PDF's `source` is `protractor`, delete
the file and mark it `uploaded` in the session (in memory). Failed or unconfirmed uploads keep the file.

### D2. Path guard

One function `deleteMadePdf(path)` resolves the path and refuses unless it is inside the app's
`invoices` temp root. Every delete goes through it. A unit test tries a picked PDF's path and a `..` path.

### D3. Session-end and startup sweep

Replacing or removing the export deletes that session's folder. `before-quit` deletes the whole `invoices` root.
App start deletes the root before anything else (covers crashes). Sweeps log counts only.

### D4. Rerun

`linkSales` treats a made PDF marked `uploaded` as linked (not missing). If a rerun adds a new line for an invoice
whose made PDF was deleted, the runner asks the fetcher and renderer (changes 11, 12) to make it again before the
upload step; if that fails, the invoice goes under PDFs needing upload with the reason.

## Risks / Trade-offs

- [File in use by an antivirus scan when deleting] → Retry once; otherwise the startup sweep removes it later.
- [Person opens a made PDF from the folder] → Not offered in the UI; the folder is temporary by design.

## Migration Plan

None.

## Open Questions

None.
