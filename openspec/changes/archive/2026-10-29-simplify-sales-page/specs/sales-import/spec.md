# Spec Delta

## MODIFIED Requirements

### Requirement: Sales screen
The Sales screen SHALL show the export (file name, date range, rows, tire lines, rows left out and why) and the
invoice PDFs summary and warnings in a single content column that uses the available page width. It SHALL NOT
show separate ProRewards or Ready to match cards. A **Match tires** action SHALL appear at the right of the page
header; it SHALL be disabled until an export is read and SHALL remain available after an export is read. Picking
a new export SHALL replace the old one; adding PDFs SHALL add to those already loaded, and the person SHALL be
able to remove them. The ProRewards sidebar item SHALL remain available.

#### Scenario: Replace the export
- **WHEN** the person picks a different export
- **THEN** the screen shows the new file's figures and any earlier review decisions for the old file are dropped

#### Scenario: No export loaded
- **WHEN** the Sales screen has no export
- **THEN** Match tires appears in the page header, disabled

#### Scenario: Export loaded
- **WHEN** an export is read
- **THEN** Match tires appears in the page header, enabled unless matching is already in progress

#### Scenario: Loaded Sales layout
- **WHEN** the person views Sales after loading an export
- **THEN** the export and PDF sections use one column, and no ProRewards or Ready to match cards appear on that screen
