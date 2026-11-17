## 1. Prepare

- [x] 1.1 Archive the finished `review-wheel-sales` change (`openspec archive review-wheel-sales`) so its requirements are in `openspec/specs/` before this change replaces them

## 2. Wheel matching (main process)

- [x] 2.1 Add `wheelSignature(description)` in `src/main/matching/` (drops wheel sizes, bolt patterns, offsets and bare numbers) with unit tests for the two scenario descriptions
- [x] 2.2 In `planLines`, use the wheel signature for wheel rows; a decision or saved choice whose label is a wheel product on the list makes the line Ready, otherwise it stays Possible wheel; `null` makes it Not eligible
- [x] 2.3 Let `matchTire`'s saved-choice check accept tire or wheel labels that are on the list
- [x] 2.4 Rename `decideTire` to `decideLine` (IPC schema, preload, main) and accept possible-wheel lines and wheel labels
- [x] 2.5 Replace `setLineLeftOut` with `setLinesLeftOut({ ids, leftOut })`
- [x] 2.6 Unit tests: approve a wheel, Steel Wheels, no wheel products, saved wheel next month, wheel product gone from the list, tire line marked as a wheel

## 3. Review table

- [x] 3.1 Remove the Claim page tire and This month columns; add the muted second line under On the report
- [x] 3.2 Add the Include checkbox column with the header select all (mixed state, current filter and search only); no checkbox on lines that cannot be entered
- [x] 3.3 Make whole rows open the panel by click, and the On the report button by Enter or Space; the checkbox does not open it
- [x] 3.4 Update the Wheels note and the footer summary wording

## 4. Side panel

- [x] 4.1 Pick the tire or wheel form from the line; "This is a wheel" and "This is a tire" switch it
- [x] 4.2 Wheel form: radio choice of this month's wheel products, Remember this choice, Use <wheel product>, Not an eligible wheel, and the no-wheel-products message

## 5. Entry

- [x] 5.1 Add a run test showing a Ready ATD Custom Wheels line is entered with its quantity and PDF, and skipped when already on the page

## 6. Docs and tests

- [x] 6.1 Update `docs/ui.md` (Review table, panel, Wheels note) and `docs/matching.md` section 6 (wheel signature)
- [x] 6.2 Update the e2e and unit tests that used the old columns, the row link or Leave this line out; add e2e checks for the row click, the checkbox not opening the panel, select all, and approving a wheel on the saved claim page fixture
- [x] 6.3 Run `openspec validate wheel-entry --strict`, typecheck, lint, format check, `npm test` and `npm run test:e2e`
