# Proposal

## Why

Saved matches has a dedicated sidebar page, so showing the same management card in Settings duplicates the list and makes Settings longer than necessary.

## What Changes

- Remove the Saved matches card from Settings.
- Keep the dedicated Saved matches page, its sidebar count, search, inactive labels, and remove actions.
- Keep the other Settings cards in their existing order and layout.
- Size each remaining Settings card to its contents. Stack Logs directly below Appearance so the right column has no row-sized gap.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `saved-matches`: Manage saved matches only on the dedicated page; show inactive matches there.

## Impact

Settings renderer, `docs/ui.md`, and focused Settings/Saved matches tests. Storage and matching behavior stay the same.
