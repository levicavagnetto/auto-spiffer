# Design

## Context

`docs/matching.md` is the complete algorithm with thresholds and the known cases, taken from the old app
(`git show origin/legacy:auto_spiffer/match.py` and friends, and `tests/test_match.py` for more cases).
`docs/ui.md` describes the Review screen and the sheet. The tire list comes from `SiteDriver.readPage()`
(change 02); the sales from change 03.

## Goals / Non-Goals

**Goals:** the old matcher's behavior exactly, as pure functions with no Electron imports, fully unit-tested;
a fast Review screen.

**Non-Goals:** editing quantities; remembering left-out lines; editable brand or noise files (they are code
constants now; a saved match covers any odd wording).

## Decisions

### D1. Modules (`src/main/matching/`, pure TypeScript)
- `sizes.ts` (from change 03), `parse.ts` (description → `{ sizes, loadSpeed, warranties, noise, brand,
  brandCandidates, words }`), `brands.ts` (table + lookup), `tireList.ts` (labels → `{ label, brand, model,
  category, kind }`), `similarity.ts` (LCS ratio), `match.ts` (tiers → `MatchResult`), `merge.ts`, `plan.ts`
  (sales + tire list + saved matches + PDFs + program dates → `Line[]`).
- `Line = { id, saleDate, invoice, description, qty, rows: number[], status, tire?, guess?, suggestions,
  reason, savedMatch: boolean, pdf?, leftOut: boolean }` with `status` one of `ready | needs-decision |
  not-eligible | not-a-tire | outside-dates`.
- `Line.id` = invoice + date + signature, stable across re-matching in the same session.

### D2. Re-planning
Matching all lines takes milliseconds, so every decision re-runs `plan()` in the main process and sends the new
lines to the screen. No incremental state to keep in sync. Left-out ids are held in memory in the main process.

### D3. Saved matches store
electron-store file `saved-matches.json`: `{ version: 1, entries: { [signature]: { label | null, example,
decidedOn } } }`, Zod-validated. Inactive is computed against the current tire list, not stored.

### D4. Screen
shadcn `Tabs` (segmented filter), `Table` (TanStack Table not needed at this size: ~50 rows), `Sheet` for the
decision, `Command` for the tire search, `Badge` for status pills. Clicking a row opens the sheet; the row menu
has Leave out / Include.

## Risks / Trade-offs

- New Excel-only wording (`BLK`, load ranges `E`, `E/10`) is handled by noise rules added in `docs/matching.md`;
  watch the first real month for other new words, and add tests for them.
