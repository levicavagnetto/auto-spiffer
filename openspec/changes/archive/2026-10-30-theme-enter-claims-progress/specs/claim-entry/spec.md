# Spec Delta

## MODIFIED Requirements

### Requirement: Enter claims screen
The Enter claims screen SHALL show the ProRewards tab beside a panel that, as in `docs/ui.md`, shows the plan and Start entering before a run, and during a run the progress ("N of M sales"), the line being entered, Pause or Resume, Stop, the page check result, an activity list newest first, and the note that the app never submits. The progress indicator SHALL use the app theme and expose an accessible name and accurate completed and total values.

#### Scenario: During a run
- **WHEN** 10 of 21 lines are done
- **THEN** the panel shows "11 of 21 sales", the line being entered, and the last lines' results

#### Scenario: Two of four sales complete
- **WHEN** two of four sales have been entered or confirmed on the page
- **THEN** the screen shows `2 of 4 sales`
- **AND** the progress indicator reports value 2 out of 4
- **AND** its track and fill use the current theme's muted and primary colors
