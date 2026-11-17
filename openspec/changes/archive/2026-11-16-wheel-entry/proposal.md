## Why

Wheel sales earn ProRewards spiffs too, but today Review only flags them as Possible wheel and tells the person to enter them by hand. The Review table is also harder to use than it needs to be: the tire lives in its own link column, and including or leaving out a line is a text link at the far right.

## What Changes

- Let the person approve a sale as a wheel on the side panel by choosing **ATD Custom Wheels** or **ATD Steel Wheels** (only those on this month's claim page). Approved wheels become Ready and are entered, with their PDF uploaded, exactly like tires.
- Save wheel choices like tire matches, so the same wording is entered next month without asking.
- Hold wheel rows back, with a plain message, when the claim page lists no wheel product.
- Review table: remove the **Claim page tire** and **This month** columns. Add an **Include** checkbox as the first column, with a select-all checkbox in its header. Show the chosen tire or wheel (or the guess, or why not) as a muted second line under **On the report**.
- Clicking anywhere on a row (or pressing Enter on it) opens the side panel, for every row.
- The side panel shows one kind of item: a tire form (today's picker) or a wheel form (wheel product choice). Each can switch the item to the other kind. Both keep **Remember this choice** and a not-eligible action.
- **BREAKING (UI only)**: the "Leave this line out / Include this line" links and the "Enter by hand" note go away; the Wheels note now explains how to approve wheels.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tire-matching`: Review table layout, Include checkboxes, rows that open the panel, the tire or wheel side panel, and approving wheels. Replaces the review-only rule for possible wheels.
- `saved-matches`: Saved decisions can hold a wheel product, under a wheel wording signature.
- `claim-entry`: Approved wheel lines are entered and get their PDF uploaded like tire lines.

## Impact

- `src/renderer/src/screens/Review.tsx` (table, panel), `src/shared/review.ts`, `src/shared/ipc.ts` and preload (bulk include call).
- `src/main/matching/plan.ts`, `match.ts`, `session.ts`, `src/main/sales/rules.ts` (wheel signatures, wheel decisions, saved wheel choices).
- `src/main/run/` already enters every Ready, included line; it gets a test for a wheel line.
- `docs/ui.md`, `docs/matching.md`, and the unit and e2e tests that use the old columns and links.
- The finished `review-wheel-sales` change must be archived first, because this change replaces requirements it adds.
