# Proposal

## Why

The Material Sales export can contain wheel sales, but Review currently groups them with unrelated "Not a tire" rows. The person needs a clear place to find likely wheels and decide whether to enter them on ProRewards by hand.

## What Changes

- Recognize likely wheel rows conservatively, including wheel wording and wheel dimensions with bolt patterns. Keep shipping, tubes, and other non-tire rows separate.
- Add a **Wheels** filter with a count on Review. Show likely wheels in the existing table as **Possible wheel** and keep them visible in **All**.
- Show a short note on the Wheels view telling the person to check whether a wheel qualifies for ATD Custom Wheels or ATD Steel Wheels and enter it on ProRewards themselves.
- Keep wheel rows out of tire matching, saved tire choices, ready-sale counts, automatic entry, and automatic PDF uploads. Do not guess Custom versus Steel or claim eligibility.

## Capabilities

### Modified Capabilities

- `sales-import`: Recognize likely wheel rows as a distinct display category instead of treating every row without a tire size as generic Not a tire.
- `tire-matching`: Preserve wheel rows through Review and display a dedicated filter and manual guidance without matching them to claim-page products.

## Impact

Sales classification and its shared schema, Review planning and display, the Review screen, `docs/matching.md` and `docs/ui.md`, and focused tests. No site automation or persistent data format is added.
