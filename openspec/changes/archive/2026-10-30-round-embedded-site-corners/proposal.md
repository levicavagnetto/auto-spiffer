# Proposal

## Why

The embedded ProRewards page is a native view that draws over the rounded card. A rounded webpage clips the site itself, so the webpage should remain square between two app-owned bars.

## What Changes

- Keep the shared native website view square.
- Add a slim bottom bar beneath the webpage on ProRewards and Enter claims. The containing card rounds that bar's lower corners.
- Preserve the existing site position, size, scrolling, and behavior.

## Capabilities

### Modified Capabilities

- `embedded-site`: The page remains visibly contained inside its rounded card on both screens.

## Impact

Native site view setup and a focused Electron test. No site automation behavior changes.
