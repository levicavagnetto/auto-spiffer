# Spec Delta

## MODIFIED Requirements

### Requirement: Rows that are not tires
A sale whose description contains "shipping" or "handling", or the word "tube", SHALL be marked "Not a tire". A sale with no tire size (as defined in `docs/matching.md`) SHALL be marked "Not a tire" unless it is recognized as a possible wheel. Possible wheels SHALL be kept for display in Review, separate from other non-tire rows. Neither category SHALL be matched to a tire or entered automatically.

#### Scenario: Shipping row
- **WHEN** a row's description is "Shipping and Handling"
- **THEN** it is marked Not a tire

#### Scenario: Tube
- **WHEN** a row's description is "18X8.50/9.50-8 FST IMPORT TR13 TUBE 18X850/950-8"
- **THEN** it is marked Not a tire

#### Scenario: Wheel dimensions and bolt pattern
- **WHEN** a row describes "XW OFFROAD XW-123 20X9 8X165.1 +12 BLACK"
- **THEN** it is marked Possible wheel, not a tire sale

#### Scenario: Wheel dimensions without the word wheel
- **WHEN** a row describes "STYLE A 20X10 -12 5X5.00 BLACK"
- **THEN** it is marked Possible wheel, not a tire sale

#### Scenario: Unclear non-tire row
- **WHEN** a row has no tire size and no reliable wheel wording or wheel dimensions with a bolt pattern
- **THEN** it remains Not a tire

#### Scenario: Tire row with incidental wheel wording
- **WHEN** a sale has a recognized tire size and only incidental wheel-related wording
- **THEN** it remains a tire sale unless its description clearly identifies a wheel product
