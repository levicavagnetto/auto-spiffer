## Context

`parseTireList` already tags claim page labels ending in "Wheels" (with no " - category") as `kind: 'wheel'`, and the Review snapshot already carries `tires[].kind`. Sales rules already mark likely wheel rows `notATire: 'wheel'`, and `planLines` turns them into `possible-wheel` lines with a per-row signature (`row|N`). `MatchSession.decide` rejects possible-wheel and not-a-tire lines and accepts only `kind === 'tire'` labels, and `matchTire` uses saved choices only for tire labels. The run enters every line that is `ready` and not left out, typing `line.tire` into Eligible Product, so the run itself does not care about kind.

The finished `review-wheel-sales` change is not archived yet. Its delta adds "Possible wheels are review-only" and rewrites "Review screen", and this change replaces both, so it must be archived first.

## Goals / Non-Goals

**Goals:**

- Approve wheels as ATD Custom Wheels or ATD Steel Wheels and enter them like tires.
- Save wheel choices under a stable wording signature.
- A simpler Review table: an Include checkbox column with select all, no Claim page tire or This month column, and whole rows that open the panel.
- One side panel with a tire form or a wheel form.

**Non-Goals:**

- Guessing Custom versus Steel. A wheel is entered only after a person or a saved choice picks it.
- Changing how possible wheels are detected in `src/main/sales/rules.ts`.
- Changing the run, the never-click list, or PDF upload.

## Decisions

1. **The wheel product is stored in `line.tire`.** A Ready wheel line has `tire = "ATD Custom Wheels"`, so the run, duplicate check, summary and search work unchanged. The renderer decides a line is a wheel when its status is `possible-wheel` or `snapshot.tires` says its label has `kind: 'wheel'`. Alternative: a separate `wheel` field, rejected because every consumer would need a second branch.

2. **Wheel signature `wheel|<words>`.** For `notATire === 'wheel'` rows, `planLines` builds the signature from the lowercased description with wheel sizes (`20X9`), bolt patterns (`8X165.1`, `5X5.00`), offsets (`+12`, `-12`) and bare numbers removed, and the remaining words joined with spaces. "XW OFFROAD XW-123 20X9 8X165.1 +12 BLACK" becomes `wheel|xw offroad xw-123 black`. This puts every size of the same wheel model under one signature, like tire signatures ignore size. Rows of the same wording on one invoice group as before.

3. **Decisions and saved choices accept wheel labels.** `MatchSession.decide` accepts possible-wheel lines and any label on this month's list, whether tire or wheel. In `planLines`, a decision or saved choice for a wheel signature makes the line `ready` with that label when the label is on the list. Otherwise the line stays `possible-wheel`, which covers months with no wheel products and saved products that left the list. A decision of `null` makes it `not-eligible`, as for tires. `matchTire`'s saved-choice check accepts a label of either kind that is on the list, so "This is a wheel" saved on a tire signature also comes back next month.

4. **Panel form is local state.** Opening a row sets `form` to `'wheel'` or `'tire'` from decision 1. "This is a wheel" and "This is a tire" only change `form`. The choice is saved only through `decideTire` (renamed `decideLine`, with the same shape `{ signature, label, remember }`).

5. **Include checkbox uses the existing left-out set.** A new IPC call `setLinesLeftOut({ ids, leftOut })` replaces `setLineLeftOut` and updates many lines in one snapshot, so select all is one round trip. The header checkbox works on the visible lines that have a checkbox: ticked when all are included, unticked when none are, and mixed (`indeterminate`) otherwise.

6. **Row opens the panel.** The `TableRow` gets `onClick` and a pointer cursor. For keyboard users the On the report cell is a real button labelled "Review <invoice> <description>"; its click bubbles to the row, so there is one handler. The checkbox cell stops click and key propagation. The Sheet returns focus to that button when it closes.

7. **Second line in On the report.** The cell becomes two lines: the description (truncated, with a `title`) and a muted line with the tire or wheel label, `<guess> ?`, or the reason ("Not on the claim page", "Possible wheel", "Not a tire"). The table's minimum width drops, since two columns go away.

## Risks / Trade-offs

- [The wheel signature joins different wheels that share wording] → Removing only numbers and size, bolt and offset tokens keeps model words such as `xw-123`. A wrong saved match can be removed in Saved matches.
- [The Eligible Product label differs from "ATD Custom Wheels"] → Labels always come from the live list, never from a constant, so the exact text the site uses is what gets saved and typed.
- [Row click and the checkbox click conflict] → Stop propagation in the checkbox cell, with an e2e test that clicking the checkbox does not open the panel.
- [Existing tests use the removed link column and Leave this line out] → Update them in the same change.

## Migration Plan

Archive `review-wheel-sales`, then build this change. Saved matches keep `version: 1`. A wheel entry is just a new signature prefix, and older stores need no change.
