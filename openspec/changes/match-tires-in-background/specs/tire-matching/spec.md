## MODIFIED Requirements

### Requirement: The tire list comes from the claim page
Matching SHALL use the Eligible Product list read from the intended month's claim page in the ProRewards web contents, and no other list. Match tires SHALL open Review only after matching succeeds. Each label SHALL be split into brand, model and category as described in `docs/matching.md`; labels with no category that end in "Wheel" or "Wheels" SHALL be wheels and never matched to a sale.

#### Scenario: Claim page not open
- **WHEN** the person clicks Match tires and the tab is not on the claim page
- **THEN** the app opens the intended claim page in the background and continues to Review on success, or shows an error toast on Sales if it cannot proceed

#### Scenario: Label split
- **WHEN** the list has "Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES"
- **THEN** its brand is Hercules, its model "Strong Guard ST Trailer" and its category "Boat Trailer"
