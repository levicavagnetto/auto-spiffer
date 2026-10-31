# claim-entry Specification

## Purpose
Enters the month's ready lines on the claim page, uploads their invoice PDFs, and stops for the person to submit.

## Requirements

### Requirement: Check the page before typing
Before entering anything, the app SHALL open the month's claim page if needed, then confirm that its promotion is the month's program, every line's sale date is inside the program dates, and every line's tire is in the product list. If navigation or any check fails, it SHALL enter nothing and say plainly what is wrong and what to do. A page check requested after a run SHALL use the same recovery and validation.

#### Scenario: Wrong program
- **WHEN** the lines are for September 2026 and the page's promotion is October 2026 Pro Rewards
- **THEN** the app tries to open the September program, then checks that page before entering; if it cannot, nothing is entered and the app explains what needs attention

#### Scenario: Page check passes
- **WHEN** the program, dates and tires all match after any needed navigation
- **THEN** the screen shows "Page check passed" with the program and date range, and the run starts

#### Scenario: Start after visiting Home
- **WHEN** the person matched tires, visited ProRewards Home, then clicks Start entering
- **THEN** the app returns to that month's claim page, checks it, and begins only when the check passes

#### Scenario: Check page and run again after visiting another page
- **WHEN** a run has finished, the person visits another ProRewards page, then clicks Check page and run again
- **THEN** the app returns to the month's claim page, rechecks it, and skips any already-entered lines visible in its sale list

### Requirement: Enter each line once
The app SHALL enter the ready, included lines one at a time, grouped by invoice in date order. Before each line it
SHALL read the page's sale list and skip a line already there with the same date, invoice, tire and quantity. A
line there with a different quantity SHALL fail and never be changed. A line SHALL count as added only once it
appears in the sale list with the right quantity.

#### Scenario: Line added and checked
- **WHEN** the app adds a line and it appears in the sale list with the same quantity
- **THEN** the activity list shows it as added and checked

#### Scenario: Run again after stopping
- **WHEN** the person stopped after 10 of 21 lines and starts again
- **THEN** the first 10 are skipped as already on the page and the rest are entered

#### Scenario: Different quantity on the page
- **WHEN** the page already has the line with qty 2 and the line says 4
- **THEN** the line fails with "already on the page with quantity 2", and the page is not changed

### Requirement: Retry and report failures
A line that fails SHALL be tried once more, unless the site called it a duplicate. A line that still fails SHALL
be reported with the site's reason and a picture of the page, and the run SHALL go on with the next line.

#### Scenario: Failed twice
- **WHEN** a line fails, is retried, and fails again
- **THEN** it is reported as failed with the site's reason, a picture of the page is saved, and the run goes on with the next line

#### Scenario: Duplicate warning
- **WHEN** the site shows its duplicate warning for a line
- **THEN** the app answers No, does not retry, and reports the line as "the website says it is already entered"

### Requirement: Upload each invoice's PDF once
After an invoice's lines, if at least one of them was **added in this run** and the invoice has a PDF, the app
SHALL upload that PDF once. If none of the invoice's lines were added in this run (all already on the page, or
all failed), it SHALL not upload. A failed upload SHALL be reported and the run SHALL go on.

#### Scenario: Normal invoice
- **WHEN** an invoice's two lines are added
- **THEN** its PDF is uploaded once

#### Scenario: Already entered earlier
- **WHEN** all of an invoice's lines were already on the page
- **THEN** its PDF is not uploaded again

#### Scenario: No PDF
- **WHEN** an invoice has no PDF
- **THEN** its lines are entered and the summary lists it under "upload these PDFs yourself"

### Requirement: Pause, resume and stop
Pause and Stop SHALL take effect between lines, never in the middle of one. Stop SHALL still upload the PDF of an
invoice whose lines were partly added in this run. The person SHALL be able to resume a paused run.

#### Scenario: Stop in the middle
- **WHEN** the person clicks Stop while a line is being added
- **THEN** that line finishes, its invoice's PDF is uploaded if a line of it was added, and the run ends as stopped

### Requirement: Never submit
The run SHALL never click Next, Back, Submit, Save Claim or Yes on the claim page. Navigation MAY click the program-choice page's Next control only after selecting the unique program for the intended month. The run SHALL answer No to the site's duplicate warning and SHALL leave the claim page scrolled to the top and the tab shown when it ends.

#### Scenario: End of a run
- **WHEN** the run ends, finished or stopped
- **THEN** the tab shows the claim page from the top, and the screen says to check the page and click Next and Submit on the website

### Requirement: Enter claims screen
The Enter claims screen SHALL show the ProRewards tab beside a panel with a consistent layout before, during, and after a run. The panel SHALL show progress, the current sale or result, the appropriate controls, the page-check result, expandable Activity and PDFs needing upload sections, and the note that the app never submits. Routine missing-PDF notices SHALL be grouped under a count rather than repeated in Activity. The PDF section SHALL show each affected invoice once and allow individual invoice-number copying. The progress indicator SHALL use the app theme and expose an accessible name and accurate completed and total values.

#### Scenario: During a run
- **WHEN** 10 of 21 lines are done and the next line is being entered
- **THEN** the panel shows "11 of 21 sales", the current line, Pause and Stop, an Activity section, and a grouped PDF count

#### Scenario: Two of four sales complete
- **WHEN** two of four sales have been entered or confirmed on the page
- **THEN** the screen shows `2 of 4 sales`
- **AND** the progress indicator reports value 2 out of 4
- **AND** its track and fill use the current theme's muted and primary colors

#### Scenario: Missing PDFs during a run
- **WHEN** several processed sales have no PDF
- **THEN** Activity does not show one routine missing-PDF notice per sale, and expanding PDFs needing upload shows their individually copyable invoice numbers

### Requirement: Run summary
After a run, the panel SHALL retain the same layout and show added, already on the page, failed with reasons and pictures, PDFs uploaded, uploads failed, and sales whose PDFs must be uploaded by hand. The finished PDF section SHALL be expanded by default. Review SHALL show each line's run result.

#### Scenario: Summary
- **WHEN** a run ends with 19 added, 1 already on the page and 1 failed
- **THEN** the result card shows the counts and Activity shows the failed line's reason and picture, while PDFs needing upload shows the affected invoices

#### Scenario: Many invoices have no PDF
- **WHEN** a completed run has more missing-PDF invoices than fit in the left pane at the minimum window size
- **THEN** the PDF list scrolls inside the panel, while the result counts, rerun button, submission reminder, and ProRewards tab remain usable

#### Scenario: Long Review page
- **WHEN** the person scrolls down a long Review list
- **THEN** the sidebar stays visible and its navigation remains usable; choosing another screen shows that screen from the top, including at the minimum window size

### Requirement: One run at a time, with guards
The app SHALL refuse to start a run while one is going or with no ready lines. When the tab is not on the month's claim page, it SHALL attempt safe navigation before starting and SHALL enter nothing unless the page check passes. Closing the app during a run SHALL ask first; if confirmed, the current line finishes and the run stops. The window SHALL stay usable during a run.

#### Scenario: Nothing to enter
- **WHEN** no line is ready
- **THEN** Start entering is disabled with "No sales are ready to enter"

#### Scenario: Close during a run
- **WHEN** the person closes the window during a run
- **THEN** the app asks "A claim is being entered. Stop after this line and close?" and only closes after the line finishes

#### Scenario: Cannot reach the claim page
- **WHEN** the app cannot safely open and verify the month's claim page
- **THEN** the run does not start, no line or PDF is sent, and the screen says what the person must do in the ProRewards tab

### Requirement: Missing PDFs remain visible after rerun

The finished Enter claims panel SHALL show invoices for ready sales without linked PDFs, even when a rerun finds those sales already on the claim page.

#### Scenario: Rerun skips an entered sale

- **GIVEN** a ready sale has no linked PDF
- **WHEN** Check page and run again finds that sale already on the claim page
- **THEN** its invoice remains in PDFs needing upload

#### Scenario: One invoice appears in multiple sources

- **WHEN** an invoice has no linked PDF and also appears in the run's missing-PDF result
- **THEN** the panel lists that invoice once

### Requirement: Recover the claim page during a run
Before each line or PDF action, the app SHALL confirm that it is on the verified month's claim page. If the tab moved, it SHALL navigate back and repeat the relevant page and duplicate checks before acting. It SHALL not continue automatically when the recovered page cannot be verified as the same claim being entered.

#### Scenario: Person leaves the page between lines
- **WHEN** the person navigates to Home after one sale and before the next sale
- **THEN** the app returns to the month's claim page, confirms the earlier sale is still visible, and checks the next sale against the live list before entering it

#### Scenario: Page changed before PDF upload
- **WHEN** the site is no longer on the claim page after an invoice's sale was added but before its PDF upload
- **THEN** the app returns to the month's claim page and confirms that sale is still visible before uploading the PDF once

#### Scenario: Recovered page does not show this run's sale
- **WHEN** the app reopens the month's claim page but a sale it added earlier in this run is missing from the page's sale list
- **THEN** it stops automatic entry, reports that the claim page needs review, and does not add another line or upload a PDF

#### Scenario: Login or site navigation cannot finish
- **WHEN** sign-in or program navigation does not reach a verifiable claim page
- **THEN** the app stops automatic entry and asks the person to finish on the ProRewards tab without guessing, submitting, or retrying the password indefinitely
