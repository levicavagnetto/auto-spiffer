# saved-matches Specification

## Purpose
Remembers the tire decisions the person makes, so the same report wording is matched without asking next time.

## Requirements

### Requirement: Save a decision

When the person settles a line with "Remember this choice" on, the app SHALL save the decision under the line's wording signature (`docs/matching.md` section 6): the exact claim page tire or wheel product label, or "not eligible", plus one example description and the date. A Possible wheel line SHALL use a wheel signature, `wheel|<compacted words>`, made from its description without the wheel size, bolt pattern and offset. A later decision for the same signature SHALL replace the earlier one.

#### Scenario: Remembered

- **WHEN** the person picks Nokian One HT for "245/55R19 103H NOK ONE BW 80K" with Remember on
- **THEN** a saved match `nokian|one` → "Nokian One HT - Light Truck Tires" is stored

#### Scenario: Not remembered

- **WHEN** the person picks a tire with Remember off
- **THEN** only this month's line changes, and nothing is saved

#### Scenario: Wheel remembered

- **WHEN** the person approves "XW OFFROAD XW-123 20X9 8X165.1 +12 BLACK" as ATD Custom Wheels with Remember on
- **THEN** a saved match with a `wheel|` signature → "ATD Custom Wheels" is stored

#### Scenario: Wheel used next month

- **WHEN** a later export has "XW OFFROAD XW-123 18X9 6X139.7 +0 BLACK"
- **THEN** it is Ready with ATD Custom Wheels, marked as "your saved match"

### Requirement: Use saved decisions first
Saved decisions SHALL be applied before any other matching rule, including the brand gate, for any sale with
the same signature, whatever its size, load, warranty or noise words.

#### Scenario: Next month
- **WHEN** a later export has "215/70R16 99H NOK ONE 80K"
- **THEN** it is Ready with Nokian One HT, marked as "your saved match"

#### Scenario: Different wording
- **WHEN** a later export has "215/70R16 99H NOK ONE X 80K"
- **THEN** the saved match does not apply

#### Scenario: Saved as not eligible
- **WHEN** the person saved an Ironman wording as not eligible
- **THEN** that wording is Not eligible next time, marked as their decision

### Requirement: Tires that leave the list

A saved tire or wheel product label that is not on the current claim page list SHALL be kept, shown as inactive, and ignored during matching, and SHALL apply again when the product returns to the list.

#### Scenario: Tire gone this month

- **WHEN** the saved tire "Nokian One HT - Light Truck Tires" is not on this month's list
- **THEN** the line is matched by the normal rules, and the saved match shows as inactive in Settings

#### Scenario: Wheel product gone this month

- **WHEN** a wheel wording is saved as ATD Steel Wheels and this month's list has no ATD Steel Wheels
- **THEN** the line stays Possible wheel and is not entered

### Requirement: Manage saved matches
Settings and the sidebar's Saved matches SHALL list every saved match (wording, tire or "Not an eligible tire",
example, date, inactive mark), with a count and a search, and let the person remove any of them. Removing SHALL
take effect at the next match.

#### Scenario: Remove a match
- **WHEN** the person removes the `nokian|one` saved match
- **THEN** it disappears from the list, and the next export's "NOK ONE" lines Need a decision again

### Requirement: Safe storage
Saved matches SHALL be stored in the user's app data folder with atomic writes, validated when read. A damaged
store SHALL not stop the app: it SHALL be renamed aside, the app SHALL start with no saved matches, and the
person SHALL be told once.

#### Scenario: Damaged store
- **WHEN** the saved matches file cannot be read
- **THEN** the app keeps the damaged file under a new name, starts with none, and says so once
