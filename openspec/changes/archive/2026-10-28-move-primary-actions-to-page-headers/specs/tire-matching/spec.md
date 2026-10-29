# Spec Delta

## MODIFIED Requirements

### Requirement: Review screen
The Review screen SHALL list every line (tire lines and Not a tire rows) with status, sale date, invoice, the
report's description, the claim page tire (or the guess, or why not), quantity and whether it has a PDF, as in
`docs/ui.md`. It SHALL filter by status with counts, search by invoice or tire, and summarize ready lines and
tires. The **Enter N sales** action SHALL appear at the right of the page header, show the number of ready
lines, and stay disabled, with the reason beside it, while any line Needs a decision. It SHALL also be disabled
when no lines are ready.

#### Scenario: Lines needing a decision
- **WHEN** two lines Need a decision
- **THEN** Enter is disabled and the page header says "Decide 2 tires to continue" beside it

#### Scenario: All decided
- **WHEN** the person settles the last line that needed a decision
- **THEN** the page header's Enter action shows the number of ready lines and becomes available

#### Scenario: No ready lines
- **WHEN** no lines are ready to enter
- **THEN** the page header's Enter action is disabled
