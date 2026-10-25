# 02 · Site tab and driver

## Why

The whole design rests on one unproven idea: driving the real ProRewards site in a tab inside the app, from the
main process, with no debugging port. Filling Telerik boxes and the Chosen dropdown, clicking Add, reading the
sale list and above all uploading a file must work this way, or the design falls back to Plan B. So this is
built and proven second, before anything depends on it.

## What Changes

- The **ProRewards tab**: a `WebContentsView` with its own persistent session, shown on the ProRewards screen
  and (later) beside the Enter claims progress, with a slim bar (Reload, address, status chip).
- A **site driver** in the main process that can: recognize the claim page; read the promotion name, the
  program dates, the tire list and the sale list; fill one line; click Add and report what happened; answer
  No on the duplicate popup; dismiss the validation popup; upload one PDF; take a screenshot. Every click goes
  through one guard that refuses the never-click list.
- A **test harness**: the saved claim page loaded in the tab with all network blocked and the legacy stub
  playing the server for Add and uploads.
- A one-time **live check** with the person, entering one real line and uploading one PDF, then removing it.

## Capabilities

### New Capabilities
- `site-driver`: the in-app ProRewards tab and everything the app can read from or do on the claim page.

### Modified Capabilities
- None.

## Impact

- `src/main/site/` (view, driver, selectors, page scripts, waits), the ProRewards screen.
- Uses `docs/site-reference.md` as its source of truth.
- Depends on `add-app-shell`. `add-tire-matching` and `add-claim-entry` depend on this.
- If the live check fails on uploads or filling, stop and ask the user before switching to Plan B (Playwright
  for Node launching Edge, behind the same driver interface).
