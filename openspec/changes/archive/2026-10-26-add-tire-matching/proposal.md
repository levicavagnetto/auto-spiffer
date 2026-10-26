# 04 · Tire matching and review

## Why

The heart of the app: turning report wording like `235/50R18 97H GEN AltiMAX RT45 65K` into the exact claim page
tire `General Altimax RT45 - Passenger Tires`, never guessing, and remembering what the person decides so they
are asked only once. The old matcher's rules were right on every real line; this change rebuilds them simply,
with the person's decisions on a clear Review screen.

## What Changes

- Take the tire list from the claim page (via the site driver) and split each label into brand, model and
  category.
- The matcher from `docs/matching.md`: parse descriptions by shape, the brand table and noise words, then saved
  match, exact, and word-match tiers with the identity-token rules, suggestions and reasons.
- Merge split rows (same invoice, date and tire) into one line.
- **Saved matches**: the person's decisions, keyed by wording signature, stored with electron-store, listed and
  removable in Settings and the sidebar's Saved matches.
- The **Review** screen and the **Which tire is this?** sheet from `docs/ui.md`, with "Leave this line out".
- A line whose sale date is outside the program's dates is held back as "Outside program dates".

## Capabilities

### New Capabilities
- `tire-matching`: the tire list, the matcher, merging, line statuses and the Review screen.
- `saved-matches`: storing, applying, listing and removing the person's tire decisions.

### Modified Capabilities
- None.

## Impact

- `src/main/matching/` (sizes from change 03, parse, brands, tire list, match, merge, plan), the saved matches
  store, the Review screen and sheet, the Saved matches card in Settings.
- Depends on `add-site-tab-driver` (reading the tire list) and `add-sales-import` (sales).
