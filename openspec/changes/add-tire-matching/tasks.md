# Tasks

## 1. Matcher (pure, unit-tested)

- [ ] 1.1 `tireList.ts`: split labels into brand, model, category and kind; verify tests over all 77 labels in `docs/reference/tire-list-2026-10.txt` (brand known for each, wheels detected, "BOAT TRAILER TIRES" → "Boat Trailer")
- [ ] 1.2 `parse.ts` and `brands.ts`: sizes, warranties, load/speed, noise (including `BLK` and load-range words), brand rules (single, not-on-list wins, ambiguous); verify tests for each rule in `docs/matching.md` sections 2 and 6 (signature)
- [ ] 1.3 `similarity.ts` (LCS ratio) and `match.ts` (saved, brand gate, exact, word match, thresholds, suggestions, reasons); verify every "Known cases" entry in `docs/matching.md` as a test, plus the extra cases in `origin/legacy:tests/test_match.py`
- [ ] 1.4 `merge.ts` and `plan.ts` (merging, outside program dates, PDFs linked, left-out lines); verify tests for each merging case in `docs/matching.md` and for the outside-dates rule
- [ ] 1.5 A private test running the real sample export against the October list: assert the count of each status and that every Ready line's tire is right by checking its description against the known cases

## 2. Saved matches

- [ ] 2.1 The store (design D3) with atomic writes, validation, and the damaged-file fallback; verify unit tests for round trip, replace, remove, inactive computed against a smaller list, and a damaged file

## 3. Screens

- [ ] 3.1 Match tires: reads the tire list from the tab (or explains that the claim page is not open), plans, and opens Review; verify an e2e test with the trimmed fixture page
- [ ] 3.2 The Review screen (filters with counts, search, table, footer summary, Enter disabled with the reason) per `docs/ui.md`; verify component tests for filtering, search and the Enter rule
- [ ] 3.3 The Which tire is this? sheet (report text, read-as chips, suggestions, tire search, Remember, Use and Not eligible) and Leave out / Include; verify component tests and an e2e test that settling one "NOK ONE" line settles all lines with that wording and saves the match
- [ ] 3.4 The Saved matches card in Settings and the sidebar link (count, search, inactive mark, remove); verify an e2e test that removing a match makes the next match ask again

## Workflow follow-up

- Run `openspec validate add-tire-matching --strict` and `npm run check`, then archive.
