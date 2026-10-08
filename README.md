# Auto Spiffer

Enters your monthly tire sales on the ATD ProRewards claim page and uploads the invoice PDFs, so you
don't have to type them in one by one. **It never submits the claim.** When it is done, you look over
the page and submit it yourself.

## What you need each month

1. The **Material Sales report** from Protractor for the month (`Material-Sales.pdf`).
2. *Optional:* the **invoice PDFs** for the month's sales, one per invoice. File names don't matter. The
   app reads the invoice number from inside each PDF. If you leave them out, the app enters the sales only
   and you upload the PDFs yourself on the ATD website.
3. The month's **ClaimForm.pdf** (the tire list printed from the ATD ProRewards website). The tire list
   changes, so load the new one each month.
4. Google Chrome or Microsoft Edge installed on the computer.

## Every month, step by step

Double-click **AutoSpiffer.exe**.

### 1. Tire list (only when a new ClaimForm is out)
- Open **Tire list** in the left menu and click **Update from ClaimForm.pdf...**.
- Pick the new file. The window shows what was added, removed, or changed. Click **Use this tire list**.
- The old list is kept in **History**.

### 2. Load files
- Click **Load files**.
- **Browse...** and pick the Material Sales report.
- *Optional:* **Add folder...** (or **Add files...**) and pick the invoice PDFs. Skip this if you upload
  the PDFs yourself on the website.
- Green checks mean the files were read. A yellow message tells you if something is wrong:
  - *The tire list is for a different month than the report.* Load that month's ClaimForm first.
  - *Report invoices have no PDF.* This only appears when you loaded some PDFs. Sales without one are
    held back as a Problem, unless you tick the matching option in Settings.
- Click **Read files and continue**. Copies of your files are kept in `data\months\<month>\`. Your
  originals are never changed.

### 3. Review
- Every sale is listed with the ClaimForm tire it was matched to.
  - **Green** (Ready): will be entered.
  - **Amber** (Needs attention): the app is not sure which tire it is. Double-click the row, pick the
    right tire, and click **Use selected tire**. Leave "Remember this choice" ticked and the app will
    know next month.
  - **Grey** (Not eligible): not on the ClaimForm, so no reward. Nothing is entered for it.
  - **Red** (Problem): will not be entered. For example the sale date is outside the program's dates, a
    PDF is missing (only when you loaded some), or the quantity differs from what was entered before.
  - **Blue** (Already entered): recorded as entered earlier, so it is left out of the run.
  - **Grey** also marks rows you excluded.
- Quantities marked `*` were added up from several lines of the report.
- **Exclude row** leaves a sale out. **Export CSV** saves the list for Excel.
- When nothing is amber, **Continue to Run** turns on. (You can also tick *Skip rows I have not
  resolved* to leave the amber ones out.)

### 4. Run
1. Click **Open claim site**. A browser opens.
2. **Log in** to the ATD ProRewards website and go to **Claims > Submit a Sales Claim** for the
   right month's program. *Or save your login once* in **Settings > Saved login**: then Open claim site logs in,
   opens the claim page, and picks the month's program for you. The password is kept in Windows
   Credential Manager, not in a file. The app tries the login once. If it can't finish (wrong password, a
   code, a CAPTCHA, no matching program), it stops and the log tells you what to do by hand.
3. Click **Start autofill**. The app first checks that the page is for the right program and
   that every tire is in the website's list. Then it types each sale, clicks Add, checks that the line
   appeared, and (if you loaded PDFs) uploads that sale's invoice PDF. With no PDFs loaded it enters the
   sales only, and you upload the PDFs on the website yourself.
4. Watch the progress and log. **Pause** and **Stop** work after the line being entered.
5. When it says **DONE**, look over the page in the browser, then click the website's own Next/Submit
   buttons yourself.

The app never clicks Next or Submit. If you run it again, it will not add anything twice. Lines already
on the page are skipped, and lines recorded as entered are left out. A run can be stopped and started
again to carry on.

A CSV report of every run is saved in the `output` folder.

## Trying it out safely

Test mode is not in the window. It is for developers and runs from the command line
(`python -m auto_spiffer fill-all`, which also has `--limit N` to enter only the first N lines). It uses a saved copy of the claim page, blocks all web access, and pretends
to be the website for Add and uploads. Nothing real is entered, and test mode keeps its own record
(`data\state_test.json`), so it never makes a real run think something was already entered.

## Settings

Click **Settings** in the left menu to change the website address, the browser (Automatic, Chrome or Edge),
whether to use invoice PDFs at all (*I upload the invoice PDFs myself*), whether sales with no PDF are still
entered when some PDFs are loaded. It also shows where the app keeps its files.

## If something goes wrong

- **A message appears.** Read it, it says what to do. The details are also in `output\auto_spiffer.log`.
- **The Run page says a field is missing or the page is wrong.** Make sure the browser is on
  *Submit a Sales Claim* for the right month. If ATD changed their page, send me `output\auto_spiffer.log`
  and any `failure_*.png` pictures in the `output` folder.
- **I entered the sales but did not submit, and now the app says "Already entered".** The app remembers
  what it entered so a submitted claim is never entered twice. If you did NOT submit (or the lines are
  gone from the website page), open **Run** and click **Re-enter this month...**. It asks first, then
  forgets this month's records so the lines are Ready again. Never do this for a claim you already
  submitted: duplicates can get a dealer removed from the program.
- **A line failed.** It is shown in red on the Review page. Fix the cause and run again: only the lines
  not yet entered are tried.
- **Windows warns about the program.** The program is not code-signed, so Windows may ask you to confirm
  the first time (More info, then Run anyway).
- **Health check.** Run `AutoSpiffer.exe --selftest` (or `--selftest-browser` to also open the saved page in
  a hidden browser) and open `output\selftest.txt`.

## Where things are

| Folder | What is in it |
|---|---|
| `data\months\2026-09\` | the copied report and invoices, your decisions for that month |
| `data\catalog.json`, `data\history\` | the current tire list and the earlier ones |
| `data\product_map.json` | tire choices you asked it to remember (you can edit it) |
| `data\brands.toml`, `data\noise.toml` | brand codes and words to ignore on the report (you can edit them) |
| `data\config.toml` | the website address and where things are on the page |
| `data\state.json` | what has been entered and uploaded, so nothing is done twice (`state_test.json` is test mode's own) |
| `data\settings.json` | window size, last month, and your Settings choices |
| `test_page\` | the saved claim page used by test mode |
| `output\` | run reports (CSV), the log, and pictures of failures |

## For developers

- `python -m pytest` runs the tests (about 360; the browser tests take around ten minutes).
- `python -m auto_spiffer --help` lists the command line tools (`prepare`, `probe-page`, `fill-all`, ...).
- `python build_exe.py` builds `dist\AutoSpiffer\AutoSpiffer.exe`.
- `docs\DESIGN.md` explains how it works. The plan and task list are in `docs\plans\`, and the original
  window mockups are in `docs\mockups\` (`python docs\mockups\mockup_gui.py B`).
