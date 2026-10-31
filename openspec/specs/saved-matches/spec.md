# saved-matches Specification

## Purpose
Remembers the tire decisions the person makes, so the same report wording is matched without asking next time.

## Requirements

### Requirement: Save a decision
When the person settles a line with "Remember this choice" on, the app SHALL save the decision under the line's
wording signature (`docs/matching.md` section 6): the exact claim page tire label, or "not eligible", plus one
example description and the date. A later decision for the same signature SHALL replace the earlier one.

#### Scenario: Remembered
- **WHEN** the person picks Nokian One HT for "245/55R19 103H NOK ONE BW 80K" with Remember on
- **THEN** a saved match `nokian|one` → "Nokian One HT - Light Truck Tires" is stored

#### Scenario: Not remembered
- **WHEN** the person picks a tire with Remember off
- **THEN** only this month's line changes, and nothing is saved

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
A saved tire label that is not on the current claim page list SHALL be kept, shown as inactive on the dedicated
Saved matches page, and ignored during matching, and SHALL apply again when the tire returns to the list.

#### Scenario: Tire gone this month
- **WHEN** the saved tire "Nokian One HT - Light Truck Tires" is not on this month's list
- **THEN** the line is matched by the normal rules, and the saved match shows as inactive on the Saved matches page

### Requirement: Manage saved matches
The sidebar's dedicated Saved matches page SHALL list every saved match (wording, tire or "Not an eligible tire",
example, date, inactive mark), with a count and a search, and let the person remove any of them. Settings SHALL
not repeat this list. Removing SHALL take effect at the next match.

#### Scenario: Remove a match
- **WHEN** the person removes the `nokian|one` saved match
- **THEN** it disappears from the list, and the next export's "NOK ONE" lines Need a decision again

#### Scenario: Settings without duplicate list
- **WHEN** the person opens Settings
- **THEN** Settings shows no Saved matches card, and the sidebar still offers the Saved matches page

### Requirement: Safe storage
Saved matches SHALL be stored in the user's app data folder with atomic writes, validated when read. A damaged
store SHALL not stop the app: it SHALL be renamed aside, the app SHALL start with no saved matches, and the
person SHALL be told once.

#### Scenario: Damaged store
- **WHEN** the saved matches file cannot be read
- **THEN** the app keeps the damaged file under a new name, starts with none, and says so once
