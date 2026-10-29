# Proposal

## Why

The Sales screen currently shows every missing invoice in one long warning sentence. The person needs those invoice numbers to find PDFs in other software, so they need to be easy to scan and copy without filling the page.

## What Changes

- Show a compact count and short explanation by default.
- Let the person expand a bounded list of missing invoice numbers and click one to copy it.
- Update the list as PDFs are linked, with no bulk copy control.

## Capabilities

### Modified Capabilities

- `sales-import`: Missing PDF display and individual invoice copying on the Sales screen.

## Impact

Sales renderer UI and its focused Electron test. PDF linking behavior stays the same.
