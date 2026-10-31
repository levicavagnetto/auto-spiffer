# Spec Delta

## MODIFIED Requirements

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
