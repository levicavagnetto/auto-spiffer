# Spec Delta

## MODIFIED Requirements

### Requirement: Open the month's claim page
Before Match tires or any claim-page-dependent check, entry, or upload, the app SHALL locate the month's claim page. If the tab is elsewhere or shows another month's claim, it SHALL go to Submit Sale, choose the one program whose name contains the month's name and year, click only that program-choice step's Next, and wait up to 15 seconds for the claim page. It SHALL never click Next on the claim page. If safe navigation cannot finish, it SHALL ask the person to finish in the tab and perform no claim action until the correct page is confirmed.

#### Scenario: Program found
- **WHEN** the month is September 2026 and Submit Sale lists "September 2026 Pro Rewards" once
- **THEN** the app picks it, clicks Next on the program-choice step, and continues the requested action when the claim page appears

#### Scenario: Program not listed
- **WHEN** no program contains "September 2026"
- **THEN** the app says "This month's program is not in the list on the website. Pick the program in the ProRewards tab." and performs no claim action

#### Scenario: Person finishes by hand
- **WHEN** the person picks the program and opens the claim page themselves after a navigation handoff
- **THEN** the app notices within 2 seconds and continues only after confirming the correct program

#### Scenario: Different month's claim page
- **WHEN** October sales are ready but the tab shows September's claim page
- **THEN** the app opens the October program through Submit Sale before checking or entering October sales

#### Scenario: Sign-in required
- **WHEN** the site redirects to the login page during navigation
- **THEN** the app follows the existing one-attempt saved-password rule and asks the person to finish signing in if it cannot
