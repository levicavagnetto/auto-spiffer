---
title: Auto Spiffer - Plan
type: feat
date: 2026-10-04
topic: auto-spiffer
---

# Auto Spiffer - Plan

## Goal

- **Objective:** A Windows desktop app (`.exe`) that reads the monthly Protractor Material Sales report, matches each tire to the ATD ProRewards tire list, and enters each sale (date, invoice #, tire, qty) plus its invoice PDF on the claim page, then stops so the person reviews and submits it themselves.
- **Approach:** Build bottom-up and test each layer from the command line before it gets a window: report parsing, then tire matching, then the tire list, then invoice PDFs, then the claim pipeline, then the sidebar window, then the browser filler, then packaging. Every layer is verified against the real files already in the project.
- **Open blockers:** None. All tasks are done and the live trial on the real site passed (see the status note under Task List).

## Product Contract

### Summary
`docs\DESIGN.md` is the source of truth for behavior. This plan only sequences the work. It does not change the design.

### Problem Frame
About 50 tires a month are typed into the ATD ProRewards claim page by hand, one field at a time, from several PDFs. The data now comes from one report (`Material-Sales.pdf`), and each sale's invoice PDF only needs uploading. Existing material in the project folder: `docs\DESIGN.md`, `Material-Sales.pdf` (September 2026), `ClaimForm.pdf` (October 2026), the Tkinter mockups in `docs\mockups\` (the chosen sidebar layout is `python mockup_gui.py B`), and `requirements.txt` (installed in the venv). Also on disk, outside the project: `Downloads\example_invoice.pdf` and the saved claim page `Downloads\ATD ProRewards - Submit Claim.html`.

### Requirements
- R1. Read `Material-Sales.pdf` into sale rows (Invoiced date, Invoice #, Description, Quantity), including wrapped descriptions and the second page.
- R2. Ignore non-tire rows (shipping, tubes). Merge rows of the same invoice and tire by adding quantities.
- R3. Parse tire descriptions in any field order (brand code, model, size, load/speed, warranty, noise).
- R4. Match each tire to an exact ClaimForm tire. Never auto-accept a model-code mismatch. Hold back uncertain tires for the person to resolve. Remember the person's choices.
- R5. Load and update the tire list from `ClaimForm.pdf`, with a diff of what changed and an archive per program.
- R6. Find each sale's invoice PDF by the invoice number inside the PDF. Report missing and unused PDFs.
- R7. Refuse to run when the report's month does not match the loaded tire list or the claim page's date window.
- R8. Fill the claim page for each sale (date, invoice #, product, qty, Add) and verify each added row. Upload the invoice PDF once per invoice.
- R9. Never click Next, Save Claim, or Submit. Stop after the last sale with the browser left open.
- R10. Never enter the same sale or upload twice, even across runs.
- R11. A sidebar window (Load files, Review, Run, Tire list) over a core that has no GUI code, plus a command line for tests.
- R12. A CSV report for each run, and a single `.exe` for monthly use.

### Key Decisions
- The sidebar window ("Option B") is the chosen design (user, after seeing mockups).
- Only confident matches are entered. Uncertain tires are held back and the person is asked once (DESIGN.md 5.2, 6.7). Split quantities are merged (DESIGN.md 6.6). Both are the current plan, to be confirmed by the user.
- **Order differs slightly from the DESIGN.md milestones:** this plan builds the window's Load files, Review, and Tire list pages before the browser filler, because they only need the core and let the user test with real data sooner. The Run page arrives together with the filler.
- The user runs every test. Tests run inside the venv.

### Acceptance Examples
- AE1. **Covers R1, R2.** Given the real September `Material-Sales.pdf`, when it is read, then 32 raw rows come out, 3 are ignored (2 shipping, 1 tube), and after matching and merging 214962, 215024, and 215091 each become one row with their quantities added (for example 214962 has qty 4).
- AE2. **Covers R3, R4.** Given `235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)`, when matched, then the result is `General Altimax RT45 - Passenger Tires`.
- AE3. **Covers R4.** Given `205/40ZR17XL 84W IRON iMOVE GEN 3 AS 40K`, when matched, then it is not eligible (not General).
- AE4. **Covers R4.** Given `NOK ONE` and `HER TERRA TRAC AT X-JOURNEY`, when matched, then both are held for the person to resolve, and after they choose, the same wording is automatic next time.
- AE5. **Covers R5.** Given the October `ClaimForm.pdf`, when imported, then 77 items load (75 tires, 2 wheels) with program dates 10/1 to 10/31/2026. (Hand count, to be confirmed by the app.)
- AE6. **Covers R7.** Given the September report and the October tire list, when the app starts a run, then it stops and says which program to load, before opening any website.
- AE7. **Covers R8, R9, R10.** Given a run against the claim page, when it finishes, then every confident sale is in the Cumulative Sale(s) List with its PDF attached, nothing was submitted, and running again adds nothing.

### Scope Boundaries
- Not doing: submitting the claim, storing the password, bypassing MFA or CAPTCHA, OCR of scanned PDFs, an LLM matching fallback.
- Deferred to follow-up: reading the tire list from the live site instead of the PDF, CSV or Excel report input (if Protractor can export it), drag and drop (`windnd`), a code-signed `.exe`.

### Dependencies / Assumptions
- Python 3.14 venv with `requirements.txt` installed (pdfplumber, rapidfuzz, playwright, pyinstaller, pytest, pillow). Tkinter is the Tk 9.0 that ships with this Python.
- The user's installed Chrome or Edge is driven by Playwright. No separate browser download.
- Real files copied into `tests\fixtures\` as test data. `example_invoice.pdf` contains a real customer's name, address, and phone. Keep it out of anything shared, or redact it, before this project is ever put in a shared repository.

## Planning Contract

### Key Technical Decisions
- KTD1. **CLI first, window second.** Every core step gets a `python -m auto_spiffer <command>` so it can be tested without a window (R11). Alternative rejected: building the window first, which hides parsing bugs behind UI.
- KTD2. **Order-independent matching by reverse lookup against the catalog** (R3, R4), using a compact key plus exact model-code tokens and brand codes. Alternative rejected: field-position parsing, since descriptions do not share an order.
- KTD3. **Plain data files beside the app** (`data\catalog.json`, `product_map.json`, `brands.toml`, `noise.toml`, `state.json`, `config.toml`) so the tire list and rules can change without a rebuild (R5).
- KTD4. **Develop the filler against the saved HTML page with an Add/upload stub**, then confirm on the live site with `--limit 1` (R8). The saved page cannot run Add or uploads itself (`__doPostBack`).
- KTD5. **One Playwright session on one worker thread**, with the window talking to it through a queue (R11).

### Where it fits
New project. Layout:

```
auto_spiffer\
  auto_spiffer\            package (python -m auto_spiffer)
    __main__.py  cli.py  models.py  paths.py  config.py
    report_parse.py  tirespec.py  brands.py  catalog.py  catalog_import.py
    match.py  product_map.py  invoices.py  pipeline.py  state.py  report.py
    fill.py  workspace.py
    gui\  (app.py, theme.py, pages\, dialogs.py, worker.py)
  data\                    brands.toml, noise.toml, catalog.json, ... (created by the app)
  tests\  fixtures\        copies of the real sample PDFs and the saved page
  docs\  (DESIGN.md, plans\, mockups\)  README.md  requirements.txt
```

## Implementation Units

The task list below is the work breakdown. Each unit in DESIGN.md maps as follows: report reading (T3 to T5), tire parsing and brands (T6 to T8), catalog (T9 to T11), matching (T12 to T17), invoices (T18 to T20), pipeline and state (T21 to T24), window (T25 to T30), filler (T31 to T36), live trial (T37), finishing and final check (T38 to T40).

## Verification Contract

Each task is tested by the user (commands inside the venv) before the next one starts. AE1 to AE7 are re-checked in the full-feature check (T40). The live-site step (T37) is done by the user watching the browser, with `--limit 1` first.

## Definition of Done

- All acceptance examples AE1 to AE7 pass.
- `pytest` passes, and the core package has no imports from `gui\` (a test checks this).
- A full September run on the real claim page enters every confident sale with its PDF, and nothing is submitted.
- Re-running adds nothing.
- `AutoSpiffer.exe` runs on a machine without Python.
- A short `README.md` explains the monthly steps. Debug prints and scratch files are removed.

## Task List

**Status (updated after the live trial):** all 40 tasks are built and tested, and the app has been used on the real site. The behavior is described in `docs\DESIGN.md`, which is kept up to date; where this plan and that document differ, the design document is right. Changes made after the plan (not tasks above):

- Invoice PDFs became **optional** (sales-only entry when none are loaded; Settings can ignore them).
- **Re-enter this month** button on the Run page, and the Run page stays reachable when every line is already entered.
- Settings window (address, browser, PDF options, test mode), a first-run browser check, plain-language error handling.
- Review page: the "Tires to enter" card was removed. Tire list page: the "exact website wording" text was removed.
- `fill-all` and the Run page use a separate test-mode record (`data\state_test.json`).
- `docs\DESIGN.md` and `docs\mockups\` were moved into `docs\`.

The task list is kept as it was written (including the original expected numbers, such as the 77-item October ClaimForm), as a record of how it was built.

Work top to bottom. Each task is built, then tested by the user, before the next starts. All commands run inside your venv from the project folder `C:\Users\LeviCavagnetto\Projects\auto_spiffer`.

### Part A. Foundation

- [x] **T1. Project skeleton and test harness** *(layer: state)*
  - **BUILD:** Create the `auto_spiffer` package with `__main__.py` and `cli.py` (a `--version` flag), a `tests\` folder with one trivial test, and copy the real samples into `tests\fixtures\` (`Material-Sales.pdf`, `ClaimForm.pdf`, `example_invoice.pdf`, the saved claim page and its `_files` folder).
  - **TEST:** Run `python -m auto_spiffer --version` -> prints a version like `0.1.0`. Run `pytest` -> `1 passed`. | Failure looks like: `No module named auto_spiffer` or pytest finding 0 tests.

- [x] **T2. Data models and paths** *(layer: state)*
  - **BUILD:** `models.py` with `SaleRow`, `CatalogItem`, `ClaimRow` (plain dataclasses). `paths.py` that finds the data folder (project folder when run from source, the folder beside the exe when frozen) and creates `data\` if missing.
  - **TEST:** Run `pytest` -> new tests for the models and paths pass. Run `python -m auto_spiffer paths` -> prints the data folder and that it exists. | Failure looks like: a path that points inside the venv or Temp.

### Part B. Reading the Material Sales report

- [x] **T3. Read the raw report rows** *(layer: logic)*
  - **BUILD:** `report_parse.py`: use pdfplumber to read the table on every page into rows (date, invoice #, description, qty), joining wrapped description lines, skipping repeated page headers and footers. Also read the header period (Start Date, End Date). Add the command `read-report <pdf>`.
  - **TEST:** Run `python -m auto_spiffer read-report tests\fixtures\Material-Sales.pdf` -> a table of **32 rows**, the first is `09/01/2026 214195 ... qty 1`, the last is `09/30/2026 215100 ... qty 4`, and the period shows `9/1/2026 to 9/30/2026`. Spot check that `214341` shows the full description `235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)` on one line. | Failure looks like: fewer than 32 rows, page 2 missing, or descriptions cut at the first line.

- [x] **T4. Flag non-tire rows** *(layer: logic)*
  - **BUILD:** In `report_parse.py`, mark a row as ignored when it is `Shipping and Handling`, has `TUBE` in the description, or has no tire size and no known brand code. Show the reason.
  - **TEST:** Run `read-report` again -> each row has a `tire` or `ignored (reason)` column. Expect exactly **3 ignored**: two `Shipping and Handling` rows and `214195` (the tube), leaving **29 tire rows**. | Failure looks like: a real tire flagged ignored, or the tube not flagged.

- [x] **T5. Convert dates and quantities** *(layer: logic)*
  - **BUILD:** Parse `09/05/2026` into a real date, and the quantity into an integer. Keep the page's expected format `mm/dd/yyyy` available as a helper. Print the total quantity of tire rows.
  - **TEST:** Run `read-report` -> prints `Total tire qty: <n>`. Add up the Quantity column of the 29 tire rows in the PDF by hand and confirm it matches. | Failure looks like: a mismatch with your hand total, or a date shown as text.

### Part C. Understanding a tire description

- [x] **T6. Strip size, load/speed, warranty, and noise** *(layer: logic)*
  - **BUILD:** `tirespec.py` and `data\noise.toml`: pull out every size shape (`235/50R18`, `255/35ZR19XL`, `LT265/75R16/10`, `ST205/75R14/8`, `35X12.5R18LT/12`, `LT37X12.50R20/10`), every load/speed index, mileage warranties (`65K`), and noise words (`BW`, `M`, `XL`, `3PMS`), including repeated sizes. What is left is a list of words. Add the command `parse-tire "<description>"`.
  - **TEST:** Run `python -m auto_spiffer parse-tire "235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)"` -> size `235/50R18`, words `GEN altimax rt45`. Then try `"NIT TERRA GRAPPLER G3 275/60R20XL 116T"` -> words `NIT terra grappler g3`, and `"LT37X12.50R20/10 126Q TOY OPEN COUNTRY A/T III BW 50K LT37X12.50R20/10 BW 126Q (50K)"` -> words `TOY open country a/t iii`. | Failure looks like: leftover size, `65K`, or `BW` in the words.

- [x] **T7. Brand codes** *(layer: logic)*
  - **BUILD:** `brands.py` and `data\brands.toml` with the codes seen (`GEN`, `HER`, `CON`, `NOK`, `TOY`, `NIT`, `FAL`) mapped to ClaimForm brands, plus known non-catalog codes (`CAR`, `FST`, `IRON`). `parse-tire` now also prints the brand. Apply the rule that a known non-catalog code wins when it appears with a catalog code.
  - **TEST:** Run `parse-tire "205/40ZR17XL 84W IRON iMOVE GEN 3 AS 40K 205/40ZR17XL BW 84W (40K)"` -> brand `IRON (not on the ClaimForm)`, not General. Run `parse-tire "HER STRONG GUARD ST ST205/75R14/8 105/101N"` -> brand `Hercules`. | Failure looks like: the Ironman tire reported as General.

- [x] **T8. Tire parsing across the whole report** *(layer: logic)*
  - **BUILD:** Command `parse-report <pdf>` that runs T6 and T7 on every tire row of the report and prints brand and words per row.
  - **TEST:** Run `python -m auto_spiffer parse-report tests\fixtures\Material-Sales.pdf` -> 29 lines. Scan them: every line has a brand, none has a size or `BW` left in the words. Tell me any line that looks wrong. | Failure looks like: an empty brand, a leftover size, or a word that clearly belongs to another field.

### Part D. The tire list (ClaimForm)

- [x] **T9. Parse `ClaimForm.pdf` into tire items** *(layer: logic)*
  - **BUILD:** `catalog_import.py`: read the tire lines (`<Brand> <Model> - <Category> $<value>`), the two wheel lines, and the program name and dates. Collect any line that looks like a tire but fails the pattern as "unparsed". Command `catalog-import <pdf>` (preview only, nothing saved yet).
  - **TEST:** Run `python -m auto_spiffer catalog-import tests\fixtures\ClaimForm.pdf` -> **77 items** (75 tires and 2 wheels, by my hand count, tell me if yours differs), program `October 2026 Pro Rewards`, dates `2026-10-01 to 2026-10-31`, and `0 unparsed`. Check that Pirelli shows 15 items (the list crosses a page break) and that `General Altimax RT45 - Passenger Tires` has value `$3.00`. | Failure looks like: a short Pirelli list, or any unparsed lines.

- [x] **T10. Save and load the tire list** *(layer: state)*
  - **BUILD:** `catalog.py`: write `data\catalog.json` (format in DESIGN.md 5.3) with a stable `id` and `site_text` per item, and archive the previous list to `data\history\`. Commands `catalog-import <pdf> --save` and `catalog-show`.
  - **TEST:** Run `catalog-import tests\fixtures\ClaimForm.pdf --save`, then `catalog-show` -> program and dates, and the same 77 items. Run the save again -> a file appears in `data\history\`. | Failure looks like: `catalog.json` missing, or the history folder empty after the second save.

- [x] **T11. Compare two tire lists (diff)** *(layer: logic)*
  - **BUILD:** `catalog.py`: compare a new list to the saved one and report Added, Removed, Value changed, and Probably renamed, plus a warning for very low overlap. Command `catalog-diff <pdf>`.
  - **TEST:** Make a copy of the saved `catalog.json` in the scratch area, remove one tire and change one value by hand, then run `catalog-diff` against the original `ClaimForm.pdf` using that copy -> shows exactly one Added, one Value changed. | Failure looks like: extra lines in the diff, or a rename reported as add plus remove.

### Part E. Matching report tires to the tire list

- [x] **T12. Normalization key and exact matching** *(layer: logic)*
  - **BUILD:** `match.py`: build the compact key (lowercase letters and digits only) and look up a tire by brand plus key. Command `match-tire "<description>"` printing the result and tier.
  - **TEST:** Run `match-tire "235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)"` -> `General Altimax RT45 - Passenger Tires (exact)`. Run `match-tire "LT255/75R17/6 111/108S TOY OPEN COUNTRY A/T III 50K LT255/75R17/6 BW 111/108S (50K)"` -> `Toyo Open Country A/T III - Light Truck Tires`. | Failure looks like: `no match` for either, which means spacing or case handling is wrong.

- [x] **T13. Order-independent word matching and the model-code rule** *(layer: logic)*
  - **BUILD:** Tier 3 in `match.py`: score each candidate of the same brand by how many of its model words appear in the line, in any order, with model codes (`RT45`, `G3`, `WRG5`, `A/T4W`) required exactly, and a penalty for unexplained words. Return a score and the runner-up.
  - **TEST:** Run `match-tire "NOK OUTPOST NAT BW 60K LT265/75R16/10 123/120S"` -> `Nokian Outpost nAT`. Run `match-tire "245/55R19 103H NOK ONE BW 80K"` -> best guess `Nokian One HT` marked medium confidence. Run `match-tire "GEN ALTIMAX RT43"` -> NOT matched to RT45. | Failure looks like: RT43 accepted as RT45, or `Terra Trac AT` matched with high confidence.

- [x] **T14. Confidence routing** *(layer: logic)*
  - **BUILD:** Turn scores into one of Ready, Needs attention, Not eligible, with the reason and top three suggestions. Rules from DESIGN.md 5.2.
  - **TEST:** Run `match-tire` on `"HER TERRA TRAC AT X-JOURNEY 3PMS 60K"` -> Needs attention (suggests Hercules Terra Trac A/T). Run it on `"NIT NT420V 305/40R22XL"` -> Not eligible. Run it on `"CAR RADIAL TRAIL HD ST185/80R13/8"` -> Not eligible. | Failure looks like: an auto-accepted wrong tire.

- [x] **T15. Match the whole report** *(layer: logic)*
  - **BUILD:** Command `match-report <pdf>` that runs T6 to T14 on all 29 tire rows and prints the result per row plus counts.
  - **TEST:** Run `python -m auto_spiffer match-report tests\fixtures\Material-Sales.pdf` -> counts about **Ready 17, Needs attention 2, Not eligible 7** as in DESIGN.md 5.2 (some rows share a tire). Compare each line against the table in DESIGN.md and tell me every difference. | Failure looks like: `IRON iMOVE GEN 3` marked Ready, or a Nokian Remedy row not Ready.

- [x] **T16. Remembered choices (product map)** *(layer: state)*
  - **BUILD:** `product_map.py` with `data\product_map.json`: save a person's decision (description signature to a tire id, or "not eligible"), look it up first (tier 1), and mark entries inactive if their tire leaves the list. Commands `resolve "<description>" --tire "<exact tire>"` and `resolve "<description>" --skip`.
  - **TEST:** Run `resolve "245/55R19 103H NOK ONE BW 80K" --tire "Nokian One HT - Light Truck Tires"`, then `match-tire` on the same text -> Ready, `(saved)`. Open `data\product_map.json` -> one readable entry. | Failure looks like: the same text still needing attention.

- [x] **T17. Merge split rows** *(layer: logic)*
  - **BUILD:** After matching, combine rows with the same invoice # and same matched tire into one row, adding quantities, and remember which report rows were merged.
  - **TEST:** Run `match-report` again -> `214962` appears once with qty **4** (1 + 3), `215024` once with qty **4**, `215091` once with qty **4**, each marked `merged from 2 rows`. Total rows drop from 29 to **26**. | Failure looks like: two rows still shown for the same invoice and tire.

### Part F. Invoice PDFs

- [x] **T18. Read the invoice number from a PDF** *(layer: logic)*
  - **BUILD:** `invoices.py`: read `Invoice # (\d+)` and `Invoice Date` from an invoice PDF (first match, not the print stamp). File-name fallback if the number is in the name. Command `read-invoice <pdf>`.
  - **TEST:** Run `python -m auto_spiffer read-invoice tests\fixtures\example_invoice.pdf` -> invoice `192982`, date `9/6/2024` (not `10/12/2024`). | Failure looks like: `10/12/2024`, which is the print time stamp.

- [x] **T19. Index a folder of invoices** *(layer: logic)*
  - **BUILD:** Index all PDFs in a folder by invoice number, and report PDFs that cannot be read or have no number. Command `index-invoices <folder>`.
  - **TEST:** Make a scratch folder with `example_invoice.pdf` plus a copy renamed `random-name.pdf` -> `index-invoices` shows invoice 192982 once with a note about the duplicate file, and no crash. If you have real September invoice PDFs, point it at that folder -> you see their invoice numbers. | Failure looks like: a crash on an unreadable PDF.

- [x] **T20. Link report sales to invoice PDFs** *(layer: logic)*
  - **BUILD:** Link each matched sale to its PDF by invoice number. List sales with no PDF, PDFs with no sale, and (as warnings only) date mismatches between the report and the invoice.
  - **TEST:** Run `match-report tests\fixtures\Material-Sales.pdf --invoices <folder>` with a folder containing only a couple of real invoices -> those sales show `PDF yes`, the rest show `No PDF` and are listed as missing. | Failure looks like: a PDF linked to the wrong invoice.

### Part G. The claim pipeline (everything before the browser)

- [x] **T21. Claim rows and the program check** *(layer: wiring)*
  - **BUILD:** `pipeline.py`: from the report, tire list, product map, and invoice index, build the final claim rows (date, invoice, tire `site_text`, qty, PDF). Include the check that the report period, the loaded tire list's program dates, and (later) the page window agree. Command `prepare <report> --invoices <folder>`.
  - **TEST:** With the saved October tire list, run `prepare tests\fixtures\Material-Sales.pdf --invoices <folder>` -> stops with a clear message that the report is September but the tire list is October (AE6). Then run with `--ignore-program-mismatch` -> prints the claim rows and a summary. | Failure looks like: it runs through without the warning.

- [x] **T22. Run report (CSV and summary)** *(layer: wiring)*
  - **BUILD:** `report.py`: write `output\report_<timestamp>.csv` and print the summary from DESIGN.md 5.8 (entered, held back, not eligible, ignored, missing PDF, totals, estimated payout from the tire values).
  - **TEST:** Run `prepare ... --ignore-program-mismatch --dry-run` -> a CSV appears in `output\`. Open it in Excel -> one line per claim row with the columns from DESIGN.md. | Failure looks like: a CSV with missing columns or garbled characters.

- [x] **T23. Remember what was entered (duplicate protection)** *(layer: state)*
  - **BUILD:** `state.py` with `data\state.json`: record each entered (invoice, tire, qty) and each uploaded file hash, and skip those on later runs. Commands `state-show` and `state-mark <invoice>` (for testing only).
  - **TEST:** Run `state-mark 214341`, then `prepare ... --dry-run` -> `214341` shows `already entered, skipped`. Run `state-show` -> lists it. | Failure looks like: a marked sale appearing in the rows to enter.

- [x] **T24. Core boundary test** *(layer: polish)*
  - **BUILD:** A pytest that fails if anything in the core imports from `gui\` or tkinter. A pytest that runs the full September pipeline on the fixtures and checks AE1 to AE3.
  - **TEST:** Run `pytest` -> all pass. | Failure looks like: an import error naming the core file that touches the GUI.

### Part H. The window (no browser yet)

- [x] **T25. Window shell with sidebar** *(layer: visuals)*
  - **BUILD:** `gui\app.py`, `theme.py`: the sidebar window from `docs\mockups\mockup_gui.py B` (navy sidebar, month label, tire list status line, four stacked pages as empty placeholders, greyed-out later pages). Command `python -m auto_spiffer gui`.
  - **TEST:** Run `python -m auto_spiffer gui` -> a window opens with the sidebar. Click Load files, Review, Run, Tire list -> the right page title shows. Review and Run are greyed out. Resize the window -> nothing breaks. | Failure looks like: pages overlapping, or a console error.

- [x] **T26. Load files page** *(layer: wiring)*
  - **BUILD:** `gui\pages\load.py`: report picker, invoice folder and files pickers, tire list status, the program mismatch banner, and the Read files button. Files are copied into `data\months\<yyyy-mm>\`. Reading runs on a background thread. Status checks show green or red messages.
  - **TEST:** Open the window, pick `Material-Sales.pdf` -> green `32 rows read`. Pick an invoice folder -> a count of PDFs. See the yellow September versus October banner. Click Read files -> Review unlocks. Pick a non-PDF file -> a red plain message, no crash. | Failure looks like: the window freezing while reading, or no banner.

- [x] **T27. Review page: cards and table** *(layer: visuals)*
  - **BUILD:** `gui\pages\review.py`: the count cards (clicking filters), the color-coded table, the `*` merged marker, and the footer counts.
  - **TEST:** After T26, open Review -> cards show the same counts as `match-report`, and the table matches the command line output. Click the Needs attention card -> only those rows show. | Failure looks like: counts that disagree with the command line.

- [x] **T28. Fix dialog, exclude, and export** *(layer: wiring)*
  - **BUILD:** `gui\dialogs.py`: the Fix dialog (best guesses, searchable list of all tires, remember checkbox, not eligible checkbox), the Exclude row button, qty change, and Export CSV. Saves go to the product map.
  - **TEST:** Double-click the `NOK ONE` row -> pick `Nokian One HT` -> the row turns green and the card counts update. Close and reopen the app, load the same files -> that row is green without asking. Exclude a row -> it shows excluded. Export CSV -> a file opens in Excel. | Failure looks like: the choice not remembered after restart.

- [x] **T29. Tire list page and update flow** *(layer: wiring)*
  - **BUILD:** `gui\pages\tires.py`: header, search box, table of tires, History menu, and Update from ClaimForm.pdf with the diff dialog and Confirm.
  - **TEST:** Open Tire list -> the October list shows. Search `Grabber` -> only Grabber tires. Click Update and pick `ClaimForm.pdf` again -> the diff says no changes. | Failure looks like: a diff reporting changes for an identical file.

- [x] **T30. Continue gating and monthly workspace** *(layer: wiring)*
  - **BUILD:** Continue to Run is enabled only with no Needs attention rows left (with a skip-the-rest choice). The workspace folder keeps the month's copies, decisions, and report. The window remembers its size and last month.
  - **TEST:** Resolve both attention rows -> Continue to Run enables. Close and reopen -> the same month is offered. | Failure looks like: Run unlocking while amber rows remain.

### Part I. The browser filler

- [x] **T31. Open the saved claim page and find every field** *(layer: wiring)*
  - **BUILD:** `fill.py` and `config.toml` (selectors and the page address): launch Chrome or Edge through Playwright, open the saved `file:///` page (test mode), and check every selector from DESIGN.md 5.4 exists. Command `probe-page`.
  - **TEST:** Run `python -m auto_spiffer probe-page` -> a browser opens on the saved page and the terminal lists each field (date, invoice, product, qty, Add, grid, upload, Next) as `found`. | Failure looks like: any `missing`, or no Chrome/Edge found.

- [x] **T32. Test stub for Add and upload on the saved page** *(layer: wiring)*
  - **BUILD:** A small script injected only in test mode so the saved page behaves like the live one: Add appends a row to the Cumulative list (and shows the duplicate popup for a repeat), and choosing a file lists it in attached documents.
  - **TEST:** With `probe-page --stub`, type values by hand in the opened browser and click Add -> a row appears in the grid. Add the same again -> the duplicate popup appears. | Failure looks like: Add doing nothing.

- [x] **T33. Enter one row** *(layer: wiring)*
  - **BUILD:** `fill.py`: set the date, invoice #, product by exact tire name through the hidden dropdown, qty, click Add, wait, and verify the new grid row. Command `fill-one --date 09/05/2026 --invoice 214341 --tire "General Altimax RT45 - Passenger Tires" --qty 4`.
  - **TEST:** Run the command in test mode -> the browser fills the fields visibly and the grid shows the row, and the terminal prints `added, verified`. Run it with a tire name that is not in the list -> a clear `not in dropdown` message and nothing added. | Failure looks like: the product dropdown still showing `Select One`, or a wrong value in the grid.

- [x] **T34. Enter all rows, duplicates, pause, and stop** *(layer: wiring)*
  - **BUILD:** `fill.py`: loop through the claim rows, cancel (never confirm) the duplicate popup, retry a failed row once, support pause and stop between rows, and record each entered row in `state.json`.
  - **TEST:** Run `fill-all` in test mode on the September rows (`--ignore-program-mismatch`) -> every ready row appears in the grid. Run it again -> `0 entered, all already entered`. Stop it halfway with Ctrl+C, run again -> resumes without repeats. | Failure looks like: a row entered twice.

- [x] **T35. Upload the invoice PDF** *(layer: wiring)*
  - **BUILD:** After an invoice's rows, set the PDF on the upload input once, wait for it to show in the attached documents, and record the file hash. A failure is reported against that invoice only.
  - **TEST:** Run `fill-all` in test mode with an invoices folder -> each invoice's PDF appears once in the attached list. Run again -> no new uploads. | Failure looks like: the same PDF attached twice.

- [x] **T36. Page check, stop point, and the Run page** *(layer: wiring)*
  - **BUILD:** The pre-entry page check (program, date window against the report, every needed tire present in the dropdown) with plain error messages. The hard stop that never clicks Next, Save Claim, or Submit. `gui\pages\run.py` with the two steps, progress counter, progress bar, Now line, live log, Pause, Stop, and the blue Nothing has been submitted bar. Worker thread and queue.
  - **TEST:** In the window (test mode), go Review, then Run -> Open claim site, then I'm on the page, start -> the progress counter and log advance, rows appear in the browser. Press Pause, then Stop -> it ends after the current row. Confirm in the code search that no click on Next exists (`grep -n "GoToStepFour" auto_spiffer\*.py` shows only the selector in config, not a click). | Failure looks like: the window freezing, or the browser moving to Step 4.

- [x] **T37. Live trial on the real site** *(layer: polish)*
  - **BUILD:** `USER:` get the **September ClaimForm.pdf** and update the tire list with it, log in, and open the September "Submit a Sales Claim" page. The app is run with `--limit 1`.
  - **TEST:** Load the September files and the tire list, run with limit 1 -> one sale is entered with its PDF attached on the real page. You check the Cumulative Sale(s) List and the documents list on the site, and delete the test entry there if you do not want to keep it. Then run the full month and review the page before submitting it yourself. | Failure looks like: any difference between what is on the site and the report CSV. Send me the log file from `output\`.

### Part J. Finishing

- [x] **T38. Friendly errors, settings, and first-run checks** *(layer: polish)*
  - **BUILD:** Plain-language error messages with details in the log file, the Settings dialog (page address, Chrome or Edge, allow rows without a PDF, test mode), a first-run check that Chrome or Edge is installed, and a confirm on closing during a run.
  - **TEST:** Rename Chrome temporarily or set an invalid browser in Settings -> a plain message explains what to do. Close the window mid-run -> it asks first and stops cleanly. | Failure looks like: a Python traceback shown to the user.

- [x] **T39. Package the .exe and write the README** *(layer: polish)*
  - **BUILD:** A PyInstaller spec (windowed, one folder), including the `data` defaults, plus `README.md` with the monthly steps in plain language.
  - **TEST:** Run the build, then double-click `dist\AutoSpiffer\AutoSpiffer.exe` -> the window opens. Run a test-mode entry from the exe. Copy the folder to a machine without Python (or a clean user profile) and open it there. | Failure looks like: a missing-module error, or a console window flashing.

- [x] **T40. Full-feature check** *(layer: polish)*
  - **BUILD:** None, a checklist run.
  - **TEST:** Walk through AE1 to AE7 using the real September files: report read and merged (AE1), `GEN AltiMAX RT45` matched (AE2), `IRON iMOVE GEN 3` not eligible (AE3), the two attention rows resolved and remembered (AE4), the October list imported (AE5) and the September list imported, the program mismatch stop (AE6), and a complete entry with PDFs, no submit, and a clean second run (AE7). Also `pytest` passes. | Failure looks like: any item above that does not match, so report which one.
