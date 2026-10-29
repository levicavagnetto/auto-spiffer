# Spec Delta

## MODIFIED Requirements

### Requirement: Review screen
The Review screen SHALL list every line (tire lines, Possible wheel lines, and Not a tire rows) with status, sale date, invoice, the report's description, the claim page tire (or the guess, or why not), quantity and whether it has a PDF, as in `docs/ui.md`. It SHALL filter by status with counts, including a Wheels filter, search by invoice or tire, and summarize ready lines and tires. The **Enter N sales** action SHALL appear at the right of the page header, show the number of ready tire lines, and stay disabled, with the reason beside it, while any tire line Needs a decision. It SHALL also be disabled when no tire lines are ready.

#### Scenario: Lines needing a decision
- **WHEN** two tire lines Need a decision
- **THEN** Enter is disabled and the page header says "Decide 2 tires to continue" beside it

#### Scenario: All decided
- **WHEN** the person settles the last tire line that needed a decision
- **THEN** the page header's Enter action shows the number of ready tire lines and becomes available

#### Scenario: No ready lines
- **WHEN** no tire lines are ready to enter
- **THEN** the page header's Enter action is disabled

#### Scenario: Wheels filter
- **WHEN** Review contains possible wheel lines
- **THEN** the Wheels filter shows their count and selecting it shows their date, invoice, description, quantity, and PDF indicator in the existing table

#### Scenario: Wheels in All
- **WHEN** Review contains possible wheel lines
- **THEN** they remain visible in All and are excluded from the generic Not a tire filter

#### Scenario: Manual wheel guidance
- **WHEN** the Wheels filter is selected
- **THEN** a note tells the person to check whether the wheels qualify for ATD Custom Wheels or ATD Steel Wheels and enter them on ProRewards themselves

## ADDED Requirements

### Requirement: Possible wheels are review-only
The app SHALL label recognized wheel sales Possible wheel without choosing a claim-page wheel product or treating them as eligible. They SHALL NOT block tire entry, count as ready tire sales, enter automatically, upload PDFs automatically, or create saved tire matches.

#### Scenario: Tire entry with a wheel row
- **WHEN** Review contains one ready tire and one possible wheel
- **THEN** Enter shows one sale and the automatic run processes only the tire

#### Scenario: Wheel product choices on the site
- **WHEN** the claim page offers ATD Custom Wheels and ATD Steel Wheels
- **THEN** the app does not pick either product for a possible wheel sale
