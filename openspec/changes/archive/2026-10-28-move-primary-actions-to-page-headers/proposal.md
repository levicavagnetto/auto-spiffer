# Proposal

## Why

The main action on Sales sits inside a card, while the main action on Review sits in the scrolling content. The screenshots show unused space at the right of each page header. Putting each action there makes the next step easier to find and keeps the two screens consistent.

## What Changes

- Show **Match tires** at the right of the Sales header, including its disabled state before an export is loaded.
- Show **Enter N sales** at the right of the Review header, with the current decision warning beside it when needed.
- Remove the old copies of those buttons from the page content; keep their actions and eligibility rules.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sales-import`: Place the Sales screen's Match tires action in the page header.
- `tire-matching`: Place the Review screen's Enter N sales action and decision warning in the page header.

## Impact

The shared renderer page header, Sales and Review screens, their component and Electron layout tests, and `docs/ui.md`.
