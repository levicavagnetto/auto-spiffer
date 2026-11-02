# 13 · Clean up made PDFs

## Why

PDFs the app makes from Protractor (change 12) are only needed until they are uploaded to ProRewards. Leaving them
in a temporary folder keeps customer invoices on disk for no reason, and the project keeps no record of past months.

## What Changes

- After the app confirms a made PDF was uploaded to the claim, it deletes the file.
- A made PDF whose upload failed, or that was never uploaded, stays until the export is replaced or the app closes,
  then it is deleted.
- When the app starts, it deletes any made PDFs left from an earlier session (for example after a crash).
- PDFs the person picked are never deleted.
- After deletion the Sales and Enter claims screens show the invoice as **Uploaded**, not missing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `claim-entry`: deleting made PDFs after a confirmed upload, and how an uploaded made PDF is shown.

## Impact

- Claim entry runner (after upload), `SalesSession`, app start and quit hooks, Enter claims and Sales screens.
- `docs/architecture.md` Storage section: made PDFs are temporary and deleted.
- Depends on change 12.
