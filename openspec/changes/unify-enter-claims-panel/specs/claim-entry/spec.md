## MODIFIED Requirements

### Requirement: Enter claims screen
The Enter claims screen SHALL show the ProRewards tab beside a panel with a consistent layout before, during, and after a run. The panel SHALL show progress, the current sale or result, the appropriate controls, the page-check result, expandable Activity and PDFs needing upload sections, and the note that the app never submits. Routine missing-PDF notices SHALL be grouped under a count rather than repeated in Activity. The PDF section SHALL show each affected invoice once and allow individual invoice-number copying.

#### Scenario: During a run
- **WHEN** 10 of 21 lines are done and the next line is being entered
- **THEN** the panel shows "11 of 21 sales", the current line, Pause and Stop, an Activity section, and a grouped PDF count

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
