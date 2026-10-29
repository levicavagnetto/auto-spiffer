# Design

## Context

`App.tsx` owns the 60 px page header. `Sales.tsx` owns the Match tires operation and its busy state; `Review.tsx` computes the ready and undecided counts and owns the Enter action. The current header has no action slot. See `docs/ui.md` for the intended header pattern.

## Goals / Non-Goals

**Goals:** Put each action at the far right of the same header row as its page title, while preserving its current handler and disabled rules. Keep the button visible when the page body scrolls past its current position.

**Non-Goals:** Change matching, claim entry, warning text, or the layout of other screens.

## Decisions

### Header action slot

Add an action target to the shared page header and let the active screen render its action into that target. This keeps Sales' busy state and Review's ready/undecided calculation beside their existing handlers. Use a React portal to render into the header target; the active screen unmounts its action when navigation changes. A callback that copies button state into `App.tsx` would duplicate screen logic and could leave a stale action during navigation.

### Page body

Remove the Sales card button and Review body button. Keep the Ready to match card's explanatory sentence and the Review promotion/date line. The disabled Match tires action also appears in the header before an export is loaded. Place the Review decision warning immediately to the left of Enter N sales, with a layout that remains readable at the 1100 px minimum window width.

## Risks / Trade-offs

- A header target may be unavailable during the first render. The shared layout must provide a stable target and re-render the screen when it becomes available; a missing target must not cause a blank action after load.
- The warning and button can crowd the header at minimum width. Verify both pages in an Electron test at 1100 × 700, including a long Review list after scrolling.
