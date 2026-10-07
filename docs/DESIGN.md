# Auto Spiffer: Design Document

This document describes the app as it is built and has been used live. It started as the plan and was
brought up to date after the live trial (October 2026). The task-by-task build plan is in
`plans\` next to this file. How to *use* the app is in the project's `README.md`.

## 1. Purpose

Each month the shop sells around 50 tires. To get paid, someone must type each sale into the ATD ProRewards
"Submit a Sales Claim" page. This app does that data entry.

**Inputs**
- **`Material-Sales.pdf`**: the Protractor "Material Sales" report for the month. **This is the data
  source.** Each row is a sale: Invoiced date, Invoice #, Description, Quantity.
- **`ClaimForm.pdf`**: the month's ATD ProRewards tire list. It lists, word for word, the options in the
  website's "Eligible Product List". It changes over time, so it is loaded from a file, never hardcoded.
- **Invoice PDFs (optional)**: one PDF per sale. If loaded, they are uploaded to the claim as supporting
  documents. If none are loaded, the app enters the sales only and the person uploads the PDFs on the
  website. With some PDFs loaded, a sale without one is held back as a Problem, unless Settings allows it.
  Settings can also say "ignore invoice PDFs" (the person uploads them).

**What the app does, in order**
1. Read the report and extract each tire sale: **Sale Date, Invoice #, tire description, Qty**.
2. Match each description to the exact tire on the ClaimForm.
3. Show the result for review; the person resolves anything the app is unsure about.
4. Open the claim page (the person logs in and gets to it). Check the page, then for each sale enter Sale
   Date, Invoice #, Product, Qty, click Add, and verify the new line. Upload the sale's PDF if there is one.
5. **Stop.** The app never submits the claim. The person reviews the page and submits it.

The program ships as a Windows `.exe` (a folder built with PyInstaller).

## 2. Goals and non-goals

**Goals**
- Automate the repetitive entry (and, when PDFs are given, the upload) for a month of sales.
- Match report tire wording to the ClaimForm even though wording and field order vary.
- Keep the tire list easy to update.
- Leave a clean, reviewable page for the human, plus a report of what was done and what needs attention.
- Never enter the same sale twice by accident.

**Non-goals**
- Clicking Next, Save Claim, Submit, or "Yes" on a duplicate warning. The human commits.
- Keeping the password anywhere but Windows Credential Manager. Saving a login is optional. The app tries the login once and never retries. MFA and CAPTCHA are left to the person.
- Guessing. A tire the app is not sure about is not entered.
- OCR of scanned PDFs, or an LLM matching fallback (possible later, not built).

## 3. User workflow

Everything happens in one desktop window with a left sidebar (section 5.10).

1. Double-click `AutoSpiffer.exe`.
2. **Tire list** (only when a new ClaimForm is out): update from the new `ClaimForm.pdf`, review the diff.
3. **Load files**: pick `Material-Sales.pdf`; optionally pick the invoice PDFs (a folder or files). Click
   "Read files and continue". Copies go into `data\months\<month>\`; originals are never touched.
4. **Review**: every sale with its matched tire and a status. Resolve amber rows by picking the right tire
   (the choice can be remembered), exclude rows, export a CSV. Continue when nothing is left amber.
5. **Run**: "Open claim site" (with a saved login the app logs in, opens the claim page and picks the month's
   program; otherwise the person does that), "I'm on the page, start". The app checks the page, enters each line with live progress, uploads PDFs if any, and stops.
6. The person reviews the Cumulative Sale(s) List on the website, uploads the invoice PDFs themselves if they
   did not give them to the app, and clicks Next/Submit.

If lines were entered but never submitted, **Re-enter this month** (Run page) clears this month's records so
they can be entered again (section 5.7).

## 4. Architecture

```
Material-Sales.pdf -> [report_parse] -> sale rows -> [match] <- [catalog from ClaimForm.pdf]
                                              |             <- [product_map: remembered choices]
invoice PDFs (optional) -> [invoices] --------+--> [pipeline] -> claim rows
                                                   (program check, merge splits, PDF link, state check)
                                                       |
                       [session] <-- decisions --  [gui]  --> [fill + browser] -> claim page (then STOP)
                                                       |
                                                    [report]  CSV in output\
```

The window (`gui\`) holds no business logic. `session.py` owns the state of a working session and is tested
without a screen. The core never imports the window or tkinter (a test enforces this; only `cli.py` may
start the window, by name).

Modules (package `auto_spiffer\`):

| Module | Job |
|---|---|
| `paths.py`, `settings.py`, `models.py` | where files live (beside the exe), remembered preferences, shared data classes |
| `report_parse.py`, `sizes.py` | read `Material-Sales.pdf` into sale rows; recognize tire sizes |
| `tirespec.py`, `brands.py` | order-independent parsing of one description; brand codes (`brands.toml`, `noise.toml`) |
| `catalog.py`, `catalog_import.py` | the tire list: save, load, archive, diff; `ClaimForm.pdf` to catalog items |
| `match.py`, `product_map.py`, `report_match.py` | tire matching, remembered choices, matching a whole report and merging splits |
| `invoices.py` | index invoice PDFs by the number inside them, link them to sales, cross-check |
| `pipeline.py`, `state.py`, `report.py` | claim rows and the program check; what was entered; CSV and summary |
| `fill.py`, `browser.py`, `page_stub.py` | Playwright entry code and config; the browser thread; the test-mode stub of the website |
| `workspace.py`, `session.py` | one folder per month; the session controller used by the window |
| `cli*.py` | command line tools for every step (`python -m auto_spiffer --help`) |
| `demo_pdfs.py` | development helper that makes fake invoice PDFs |
| `gui\` | `app.py`, `theme.py`, `worker.py`, `dialogs.py`, `settings_dialog.py`, `selftest.py`, `pages\{load,review,run,tires}.py` |

Outside the package: `run_app.py` (what the exe runs), `build_exe.py`, `tests\`, and `docs\mockups\` (the original design
mockups, run with `python docs\mockups\mockup_gui.py B`; the Review mockup still shows a "Tires to enter"
card that was later removed).

## 5. Key design decisions

### 5.1 Reading Material-Sales.pdf

The PDF is text-based with a real table, so no OCR. **pdfplumber** reads the table on every page.

Header block (read for the program check): `Start Date` and `End Date` define the **period** the report covers.

| Column | Example | Becomes |
|---|---|---|
| Invoiced | `09/05/2026` | Sale Date (written `mm/dd/yyyy` for the page) |
| Invoice # | `214341` | Invoice # |
| Description | `235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)` | tire description (5.2) |
| Quantity | `4` | Qty |

- Descriptions wrap inside a cell; the table reader joins them. Repeated page headers are skipped.
- **Fallback reader:** if a PDF has no table, rows are read by word position (find the column headings, use each
  date line as a row anchor, give each description word to the nearest anchor). Plain line-by-line text cannot
  be trusted because the report centers dates and quantities vertically, so a wrapped description's first line
  sits above its date.
- **Non-tire rows are ignored:** `Shipping and Handling`, tubes, and anything with no tire size.
- **Split rows:** the same invoice and tire can appear on several rows (`214962`: qty 1 and 3). After matching,
  rows with the same invoice and the same matched tire are **merged and their quantities added** (4). This
  also avoids the site's duplicate-line popup. Different tires on one invoice stay separate lines.
- The tool prints the totals (rows read, tire rows, ignored rows, total quantity) so they can be compared with the PDF.

If Protractor can export the report as CSV or Excel, that would be more reliable than parsing a PDF; the
reader is a single module, so a CSV reader could replace it without touching the rest.

### 5.2 Matching report descriptions to ClaimForm tires

**The problem.** The report and the ClaimForm word a tire differently, and report descriptions do not share a
field order, for example:

```
235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)     size first, brand code, model, size again
NIT TERRA GRAPPLER G3 275/60R20XL 116T                          brand code first, size last
```
The ClaimForm says `General Altimax RT45 - Passenger Tires`. Plain comparison fails, and plain fuzzy matching is
dangerous because look-alike models (`RT43` vs `RT45`) score as nearly identical.

**Order-independent parsing (`tirespec.py`).** Never rely on position. Pull out the parts with a recognizable
shape from anywhere in the description and keep the rest as an unordered bag of words:
1. **Sizes** in every shape seen (`235/50R18`, `255/35ZR19XL`, `LT265/75R16/10`, `ST205/75R14/8`,
   `35X12.5R18LT/12`, `LT37X12.50R20/10`). Every occurrence is removed (the report repeats the size).
2. **Load/speed ratings** (`97H`, `123/120S`) and **mileage warranties** (`65K`, `(65K)`).
3. **Noise words** from the editable `noise.toml` (`BW`, `M`, `XL`, `3PMS`, ply ratings like `10PR`).
4. **The brand code** (`GEN`, `HER`, `CON`, `NOK`, `TOY`, `NIT`, `FAL`) from the editable `brands.toml`. Full
   brand names work too. Codes for brands that are never eligible (`CAR`, `FST`, `IRON`) are listed so a line
   like `IRON iMOVE GEN 3 AS` is read as an **Ironman** tire (`GEN` is part of its model name), not General.
5. What remains is the **bag of model words** (`AltiMAX`, `RT45`).

**Reverse lookup against the catalog (`match.py`).** The ClaimForm is a known, finite list, so the matcher asks
"which tire on the list is best explained by these words, for this brand?". Tiers, first confident hit wins:
1. **Saved choice** (`product_map.json`): something the person already decided, including "not eligible".
2. **Exact name**: the model words squeezed to lowercase letters and digits equal a list model
   (`AltiMAX RT45` = `Altimax RT45`; spacing and punctuation drift is absorbed).
3. **Order-independent word match.** *Identity tokens* decide which tire it is: anything with a digit (`RT45`,
   `G3`, `7`), roman numerals (`II`, `III`) and short letter codes (`HT`, `AT`, `AS`). They must match exactly in
   both directions, so `RT43` is never accepted for `RT45`, and `ONE` is never accepted for `One HT` without a
   person looking. Longer descriptive words may have a small spelling slip or be missing from the report
   (`...ST Trailer`). Words written joined or split (`A/TX`, `ATX`, `A TX`) are handled.

**Routing** (what happens to each line):

| Result | Meaning |
|---|---|
| **Ready** | exact or saved match; or a word match with all identity tokens agreeing, nothing unexplained, at least half the list name found, and a clear lead over the runner-up |
| **Needs attention** | a close match with an identity token missing or extra, extra words in the report line, or two close candidates. NOT entered until the person decides |
| **Not eligible** | the brand is not on the ClaimForm, or nothing on the list for that brand is a believable match |

A model-code mismatch is never auto-accepted. Every decision the person makes is saved in `product_map.json`
(editable), so the same wording is automatic next month. If a saved choice points to a tire that has left the
list, it is kept but ignored (and marked inactive), and comes back if the tire returns.

**Results against the September 2026 report** (matched against the October list; the September list may differ):
17 lines ready (qty 60), 2 needing attention (`NOK ONE`, `HER TERRA TRAC AT X-JOURNEY`), 7 not eligible
(`CAR RADIAL TRAIL HD`, `CON EXTREMECONTACT DWS06`, `NIT NT420V`, `IRON iMOVE GEN 3 AS`, `HER ROADTOUR CONNECT AS`,
`NOK NORDMAN SOLSTICE 4`), 3 rows ignored (a tube and two shipping rows).

### 5.3 The tire catalog (ClaimForm) and keeping it current

`ClaimForm.pdf` is the monthly list printed from the site. Its tire names are **word for word the options of the
website's Eligible Product List** (a test confirms the saved page's dropdown equals the October list). The
October 2026 list has 77 entries (75 tires, 2 wheels):

```
<Brand> <Model> - <Category>                         $<unit value>
General Altimax RT45 - Passenger Tires               $3.00
Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES  $1.00
ATD Steel Wheels                                     $2.50   (no category; kept as kind "wheel", never matched to tires)
```

**Storage:** `data\catalog.json` holds the program name and dates, the import date, and each item with a stable
`id`, its `site_text` (the exact dropdown label), brand, model, category, value, and kind. Saved choices point to
`id`, so a cosmetic rename does not break them.

**Updating:** Tire list page, "Update from ClaimForm.pdf..." (or `catalog-import <pdf> --save` on the command
line). The app parses the PDF (a regex per line over the whole document, so the Pirelli list crossing a page
break is fine), then shows a **diff** against the current list: Added, Removed, Value changed, Probably renamed
(same brand, category and value, similar name), plus a warning when almost nothing overlaps (probably the wrong
file). Lines that look like a tire row but cannot be read are listed as **unparsed**, so a layout change never
silently drops tires. On confirm, the old list is archived to `data\history\` and the new one becomes current.

The app uses **the current list**. History is viewable (read only) but is not selected automatically by sale date:
for a different month, load that month's ClaimForm.

**Program check:** the report's period must lie inside the loaded list's program dates. If not (a September
report with an October list), the app says so and will not continue (the Load page has a "continue anyway"
box for trying things out only). On the Run page the live page is checked as well (5.6).

### 5.4 The claim page

Analyzed from a saved copy of the page and confirmed on the live site. It is Step 3 of a claim wizard, built
with ASP.NET WebForms, Telerik controls and the Chosen dropdown plugin.

| Item | What it is |
|---|---|
| Sale Date | Telerik date box `#ctl00_DefaultContent_InvoiceDateRadDatePicker_dateInput`; the page limits it to the program's dates |
| Invoice # | text box, max 50 characters |
| Eligible Product | a hidden `<select>` behind the Chosen search list; option labels are the ClaimForm lines |
| Qty | Telerik numeric box, max 3 digits |
| Add | a link that runs an ASP.NET `__doPostBack` (a partial page refresh) |
| Result list | the "Cumulative Sale(s) List" grid (Sale Date, Invoice Number, Product, Qty Claimed, Action) |
| Supporting documents | a RadAsyncUpload file input (multiple files allowed; `.pdf` accepted, 500 max; the site renames files to be unique) |
| Duplicate warning | a "Confirm - Duplicate Line Item Entered" popup with Yes and No |
| Navigation | Back and Next. **Never clicked.** |

All selectors live in `data\config.toml`, so a website change is usually a one-line edit, not a new build.

**Test mode.** The saved copy of the page is opened in a real browser. Its own scripts run (the dropdown and
text boxes work for real), but ATD's date-picker code is not active in the copy. Every web request is blocked,
so nothing can reach the real server, and a small stub (`page_stub.py`) plays the server for Add (appends a row,
shows the duplicate or validation popup) and for file uploads. Test mode keeps its own record
(`data\state_test.json`) so it never makes the real run think something was entered. It is used for development
and for the command line and the tests (the window has no Test mode option).

### 5.5 Invoice PDFs: finding and uploading

- Every PDF is indexed by the **invoice number read from inside it** (`Invoice # (\d+)`), with the file name as a
  fallback. File names do not matter. If the PDF and the file name disagree, the PDF wins.
- A sale is linked to its PDF by invoice number. An invoice with several lines gets its PDF uploaded once.
- **Optional** (section 1). With PDFs loaded, a sale without one is held back as a Problem unless Settings allows it.
- A PDF is uploaded **only if at least one line of its invoice is actually entered**. PDFs for sales that are not
  eligible, excluded, skipped, unresolved or failed are not uploaded.
- The invoice date and tire size on the PDF are cross-checked against the report; differences are warnings, never blocks.
- Files go up unchanged. They contain customer information, which the program requires on supporting invoices.

### 5.6 Browser automation

- **Playwright** drives the person's installed **Chrome or Edge** (`browser = "auto"` tries Chrome then Edge),
  shown on screen. One dedicated thread owns the browser (`browser.py`), because Playwright must stay on the
  thread that started it and the window has to stay open between "Open claim site" and "start".
- The person logs in. No credentials are stored. The app finds the open tab showing the claim form.
- **Page check before typing anything** (`check_page`): the page's promotion matches the tire list's program;
  every line's sale date is inside the page's date window; every tire exists in the page's dropdown. Otherwise
  it explains in plain words and enters nothing.
- **For each line:** skip it if the page's list already has it (a different quantity on the page is a failure, never
  overwritten). Type the date, invoice number and quantity like a person (click, select all, type, Tab) and check
  what the box shows. Pick the product by its exact name through the Chosen list, falling back to the hidden
  select. Click Add and wait to see what happened: the new line appears in the list (verified date, invoice, product
  and quantity), a duplicate popup (answered **No**), or a validation popup (read, dismissed, reported). A failed
  line is retried once, then reported with a screenshot in `output\`, and the run continues.
- **Uploads:** after an invoice's lines are in, the PDF is attached and the app waits for a "done" signal (any of
  the selectors in `config.toml`). A failed upload is reported and the run continues. A file hash is recorded so the
  same PDF is never uploaded twice.
- **Pause** and **Stop** act between lines, never in the middle of one.
- **Stop point:** at the end the page is scrolled to the top, a summary and a CSV report are written, and the browser
  is left open.

### 5.7 Safety and correctness

- **Never submits.** `ClaimPage` refuses to click anything on the `never_click` list (Next, Back, "Yes" on a
  duplicate, the later steps' Submit and Save buttons). A test checks the stub never receives a Next click.
- **Duplicate protection.** The ClaimForm terms say duplicate invoices for claimed tires can lead to removal from the
  program, so entries are recorded. `data\state.json` keeps each entered line (invoice, product, quantity, date) and
  each uploaded file hash. A recorded line shows as **Already entered** and is left out of the run. A recorded line
  whose quantity has since changed becomes a **Problem**, not a silent second claim. The page's own list is also
  checked at run time.
- **Re-enter this month** (Run page). The record cannot tell "entered and submitted" from "entered, never
  submitted". So the person can clear this month's records on purpose: the button lists the invoices, warns about
  duplicates, **defaults to No**, and removes only the open report's invoices (entered and uploaded records, plus
  the test-mode record). The lines become Ready again.
- **Only confident rows are entered.** Amber rows are held back until the person decides or skips them.
- **Problems are not entered:** a sale date outside the program dates, no invoice PDF (when PDFs are in use), or a
  quantity that differs from what was recorded.
- `prepare` (command line) and the Review page show everything without opening a browser.

### 5.8 Report and logging

After each run a CSV is written to `output\report_<timestamp>.csv` (opens in Excel): status, invoice, date, qty,
product, unit value, estimated payout, PDF, merged rows, report description, notes; ignored rows are included. The
summary shows lines and quantity by status, missing PDFs, and the estimated payout, so it can be compared with the
website before submitting. `output\auto_spiffer.log` has the details of unexpected errors; the person only sees
plain-language messages.

### 5.9 Packaging as .exe

- `python build_exe.py` runs **PyInstaller** (`--onedir`, `--windowed`) and produces `dist\AutoSpiffer\AutoSpiffer.exe`
  (about 185 MB because it carries the browser helper). It bundles the default data files, Playwright and pdfminer
  data, and copies the saved test page and `README.md` next to the program.
- No browser is bundled: Chrome or Edge on the computer is used. The first run checks that one is installed.
- `data\`, `output\` and the saved page live beside the exe, writable, not inside it.
- `AutoSpiffer.exe --selftest` (or `--selftest-browser`) checks the pieces and writes `output\selftest.txt`.
- The exe is not code-signed, so Windows may warn the first time.

### 5.10 The app window

Tkinter (ttk) with a left sidebar and one page at a time. The window has no business logic; it calls `session.py`.
The same core runs from the command line, which is how most of it is tested.

**Sidebar:** app name, the month being worked on, a tire-list status line (orange when the list is for a different
month), the pages (**1 Load files, 2 Review, 3 Run, Tire list**), the workspace name, **Settings**, and the version.
Review and Run are greyed out until their earlier step is done, with a hint saying why.

**Load files.** Report picker; invoice PDFs (**optional**, by folder or by files, with a status that says what
happens with none); the tire list status with a button to load a ClaimForm; a banner for a missing tire list or a
different-month list, with a "continue anyway" box for trying things out; "New month" and "Open recent". "Read files
and continue" copies the inputs into the month workspace and matches everything.

**Review.** Four count cards that filter the table when clicked (Ready, Needs attention, Not eligible, Problem), a
colored table of every sale, and a footer summary. `*` after a quantity marks several report rows added together; the
PDF column shows `-` when no PDFs are in use. Buttons: Fix selected..., Exclude row (Include row), Export CSV, a "Skip
rows I have not resolved" box, and Continue to Run (disabled with the reason shown while rows need a decision).
The **Fix dialog** (double-click a row) shows the report text, best guesses with match percentages, a searchable list
of every tire, "Remember this choice", "not an eligible tire", and a quantity box. A note appears when lines are
recorded as already entered, pointing to Re-enter on the Run page.

**Run.** Buttons: Open claim site, I'm on the page start, Pause (Resume), Stop, and **Re-enter this month...**. A page-check line,
a large "12 of 17 sales" counter with a progress bar, a "Now:" line, and a live log. Closing the window asks first
if a run is going or a browser is open. After a run, Review shows Entered and Failed rows and the CSV report is saved.

**Tire list.** Program, dates and counts; a searchable table of every tire with its value; Update from ClaimForm.pdf
(with the diff dialog), Export CSV, and History (earlier lists, read only).

**Settings.** The website address, the browser (Automatic, Chrome, Edge), "I upload the invoice PDFs myself (ignore
loaded PDFs)", "when some PDFs are loaded, still enter sales that have none", Test mode, and where the app keeps
its files (with an Open folder button). The address and browser are written to `config.toml`.

**Friendly behavior.** The window remembers its size and the last month and reopens where the person left off. Long
work runs on background threads through a queue, so the window never freezes. Every expected problem is a plain
message; unexpected errors show a generic message and go to the log. A browser check at startup says what to do if
neither Chrome nor Edge is installed.

**Month workspace.** `data\months\2026-09\` holds the copied report and invoices, `workspace.json`, and
`decisions.json` (excluded rows, changed quantities, the skip and override choices). A month can be reopened later.

## 6. Decisions made, and what is still open

**Decided (and used live)**
- Report-driven: the Material Sales report is the data source; invoice PDFs are optional and only uploaded.
- The **sidebar window** (Option B) after comparing mockups.
- Only confident matches are entered; uncertain ones are held and asked once, then remembered.
- Split quantities (same invoice, same tire) are merged.
- Months must match: the report's month decides which ClaimForm to load (a September list for September sales).
- With a saved login the app logs in and navigates once. If that fails or is unclear (wrong password, MFA, CAPTCHA, no matching program) it stops and the person finishes by hand. Without one, the person does it all.
- Invoice file names do not matter; the number inside the PDF is used.
- Nothing is submitted by the app, ever.
- The live trial on the real site (September 2026) passed.

**Still open**
1. **CSV or Excel export** of the Material Sales report from Protractor would be more reliable than reading the PDF.
2. **Terms of use.** Confirm the program allows automated entry (the human keeps login and the final submit).
3. **Dealer scope.** Whether the ClaimForm differs per dealer or per program id (`pid` and `did` in the page address).
4. **The Pirelli brand code** on the report is unknown; until seen, a Pirelli line shows an unknown brand (add its code to `brands.toml`).
5. **Code signing** for the exe, so Windows does not warn.
6. Possible later: drag and drop of PDFs, reading the tire list from the live page instead of a PDF, an LLM fallback for stubborn tires.

## 7. Tech stack

Python 3.14 in a virtual environment (any recent Python 3 with Tk should do), pdfplumber, rapidfuzz, playwright,
tkinter/ttk, tomllib, PyInstaller, pytest, and Pillow (only for the mockup screenshots).

## 8. Milestones

All built, in this order (each was tested before the next):
1. Foundation, report parsing, tire parsing and brands, the tire list (ClaimForm) with diff and archive.
2. Matching, remembered choices, merging, invoice PDFs, the claim pipeline (program check, state, CSV).
3. The window: shell, Load files, Review with the Fix dialog, Tire list, workspaces.
4. The browser: probe, one row, all rows, uploads, page check, the Run page.
5. Finishing: Settings, plain errors, first-run checks, the self-check, the `.exe`, the README.
6. Live trial on the real site, then changes after use: optional invoice PDFs, Re-enter this month, trimmed
   Review and Tire list wording.

## 9. Testing

`python -m pytest` runs 358 tests (about 10 minutes, because the browser tests open real Chrome). They use the real
September report, the real October ClaimForm, a real invoice, and the saved claim page.
- **Parsing and matching:** the report (rows, wrapped text, page 2, ignored rows, totals), sizes, every one of the 29
  September tire rows, near-miss traps (`RT43`/`RT45`, `Grabber APT`/`A/TX`), the Ironman trap, shuffled word order.
- **Tire list:** import (77 items, Pirelli across the page break), unparsed lines, diff and rename, archive, saved choices.
- **Invoices and pipeline:** number read from inside a PDF, duplicates, missing and unused PDFs, cross-checks, the
  month check, already-entered and changed-quantity handling, the CSV, optional PDFs.
- **The session and window:** decisions, workspaces, and the real window driven hidden through every page, including
  Settings, Re-enter and closing.
- **The browser:** real Chrome against the saved page with the stub: typing, the product list, Add, duplicate and
  validation popups, uploads, retry, pause, stop, the never-click list, and a full run.
- **Acceptance** (`tests\test_acceptance.py`): one test per acceptance example of the plan.
- **Packaging:** the self-check from source, and from the built exe if it exists.
- **Architecture:** the core never imports the window or tkinter.
- **Live:** a first real run with "Only the first N lines" set to 1, then the rest, with a human watching.
