# Spec Delta

## MODIFIED Requirements

### Requirement: The tire list comes from the claim page
Matching SHALL use the Eligible Product list read from the month's claim page open in the ProRewards tab, and no other list. Before reading, the app SHALL navigate to that page when needed. Each label SHALL be split into brand, model and category as described in `docs/matching.md`; labels with no category that end in "Wheel" or "Wheels" SHALL be wheels and never matched to a sale.

#### Scenario: Claim page not open
- **WHEN** the person clicks Match tires and the tab shows another ProRewards page
- **THEN** the app opens the month's claim page and reads its live Eligible Product list before matching

#### Scenario: Label split
- **WHEN** the list has "Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES"
- **THEN** its brand is Hercules, its model "Strong Guard ST Trailer" and its category "Boat Trailer"
