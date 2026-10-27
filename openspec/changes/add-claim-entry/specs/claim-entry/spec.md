# Spec Delta

## Purpose

Enters the month's ready lines on the claim page, uploads their invoice PDFs, and stops for the person to submit.

## ADDED Requirements

### Requirement: Check the page before typing
Before entering anything, the app SHALL confirm that the tab shows the claim page, that its promotion is the
month's program, that every line's sale date is inside the page's program dates, and that every line's tire is
in the page's product list. If any check fails, the app SHALL enter nothing and say plainly what is wrong and
what to do.

#### Scenario: Wrong program
- **WHEN** the lines are for September 2026 and the page's promotion is October 2026 Pro Rewards
- **THEN** nothing is entered and the app says the page is for October 2026 and to open the September program

#### Scenario: Page check passes
- **WHEN** the program, dates and tires all match
- **THEN** the screen shows "Page check passed" with the program and date range, and the run starts

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
The run SHALL never click Next, Back, Submit, Save Claim or Yes, and SHALL leave the claim page scrolled to the
top and the tab shown when it ends.

#### Scenario: End of a run
- **WHEN** the run ends, finished or stopped
- **THEN** the tab shows the claim page from the top, and the screen says to check the page and click Next and Submit on the website

### Requirement: Enter claims screen
The Enter claims screen SHALL show the ProRewards tab beside a panel that, as in `docs/ui.md`, shows the plan
and Start entering before a run, and during a run the progress ("N of M sales"), the line being entered, Pause or
Resume, Stop, the page check result, an activity list newest first, and the note that the app never submits.

#### Scenario: During a run
- **WHEN** 10 of 21 lines are done
- **THEN** the panel shows "11 of 21 sales", the line being entered, and the last lines' results

### Requirement: Run summary
After a run, the screen SHALL show a summary: added, already on the page, failed with reasons and pictures, PDFs
uploaded, uploads failed, and sales whose PDFs must be uploaded by hand. Review SHALL show each line's run result.

#### Scenario: Summary
- **WHEN** a run ends with 19 added, 1 already on the page and 1 failed
- **THEN** the summary shows those counts, the failed line's reason and picture, and the PDFs to upload by hand

#### Scenario: Many invoices have no PDF
- **WHEN** a completed run has more missing-PDF invoices than fit in the left pane at the minimum window size
- **THEN** the summary shows their count and every invoice in a scrollable detail area, while the result counts,
  rerun button and submission reminder stay visible inside the pane and the ProRewards tab remains usable

#### Scenario: Long Review page
- **WHEN** the person scrolls down a long Review list
- **THEN** the sidebar stays visible and its navigation remains usable; choosing another screen shows that screen
  from the top, including at the minimum window size

### Requirement: One run at a time, with guards
The app SHALL refuse to start a run while one is going, while the tab is not on the claim page, or with no ready
lines. Closing the app during a run SHALL ask first; if confirmed, the current line finishes and the run stops.
The window SHALL stay usable during a run.

#### Scenario: Nothing to enter
- **WHEN** no line is ready
- **THEN** Start entering is disabled with "No sales are ready to enter"

#### Scenario: Close during a run
- **WHEN** the person closes the window during a run
- **THEN** the app asks "A claim is being entered. Stop after this line and close?" and only closes after the line finishes
