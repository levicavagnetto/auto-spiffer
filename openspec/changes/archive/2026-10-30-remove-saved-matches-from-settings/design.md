# Design

## Context

`Settings.tsx` renders `SavedMatchesCard` both when `savedMatchesOnly` is true (the dedicated page) and as the last card in ordinary Settings. `App.tsx` uses the same component for both routes. The card's search and removal behavior should stay attached to the dedicated route.

## Goals / Non-Goals

**Goals:** Remove only the duplicate card from ordinary Settings and retain the dedicated page unchanged.

**Non-Goals:** Change saved-match storage, matching, the sidebar count, or the remaining Settings cards.

## Decisions

Keep `SavedMatchesCard` and the `savedMatchesOnly` path. Stop appending `savedCard` to the ordinary Settings grid. This avoids duplicating the card or splitting a small existing component. The remaining four Settings cards continue to fill the two-column grid.

Use two independent vertical card stacks: ProRewards sign-in and Updates on the left, Appearance and Logs on the right. Each card retains its natural height, and Logs sits directly below Appearance with the normal card gap.

## Risks / Trade-offs

- The shared component can be accidentally removed from both routes. Cover ordinary Settings and the dedicated page in focused tests.
