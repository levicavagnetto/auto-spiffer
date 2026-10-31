# Design

## Decision

Add a local shadcn-style Progress wrapper around Base UI's Root, Track, and Indicator. Apply the existing `bg-muted` and `bg-primary` tokens to the track and indicator. Feed the root `done` and `total` through its `value` and `max` props, with a minimum max of 1 while totals load. Give the bar the accessible name `Sales entered`.

The Enter claims screen keeps its existing count heading and swaps only the native `<progress>` control. The component stays reusable for later progress displays.

## Verification

The focused screen test verifies the progressbar name, count, total, and component anatomy. Build and typecheck confirm integration.
