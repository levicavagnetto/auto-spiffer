## MODIFIED Requirements

### Requirement: Sign in once
When the site's login page appears and a password is saved, the app SHALL fill the email and password and click Log in once. If the site shows a login error, the app SHALL stop promptly. If the login page is still showing after 10 seconds without a specific error, it SHALL stop and report the failure. It SHALL not retry the same saved credentials automatically. Saving a replacement password SHALL allow a new attempt in the open app. During Match tires, the app SHALL keep Sales visible and show a temporary error toast with exactly "Could not log in" if sign-in cannot complete. The person MAY open ProRewards to finish signing in.

#### Scenario: Cookies still valid
- **WHEN** the app starts and the site's login is still valid
- **THEN** the saved password is not used

#### Scenario: Wrong password
- **WHEN** the saved password is wrong during Match tires
- **THEN** the app tries once, stops, and shows a "Could not log in" toast on Sales

#### Scenario: No saved password
- **WHEN** Match tires reaches the login page and no password is saved
- **THEN** the app keeps Sales visible and shows a "Could not log in" toast

#### Scenario: Corrected password in the open app
- **WHEN** the previous password failed and the person saves a corrected password in Settings
- **THEN** the app makes a fresh sign-in attempt without restarting

### Requirement: Open the month's claim page
When the person clicks Match tires and the claim page is not open, the app SHALL load the site in its hidden view, go to Submit Sale, choose the one program whose name contains the month's name and year, click that step's Next, and wait up to 15 seconds for the claim page. It SHALL never click a button on the claim page itself. Match tires SHALL keep Sales visible while this happens. If the program cannot be reached automatically, it SHALL show an error toast on Sales and let the person open ProRewards to fix it. Interactive claim-entry navigation MAY ask the person to finish in the tab and continue when the claim page is showing.

#### Scenario: Program found
- **WHEN** the month is September 2026 and Submit Sale lists "September 2026 Pro Rewards" once
- **THEN** the app picks it, clicks Next, and continues to matching while Sales stays visible

#### Scenario: Program not listed
- **WHEN** no program contains "September 2026"
- **THEN** Match tires shows an error toast on Sales directing the person to ProRewards

#### Scenario: Person finishes by hand
- **WHEN** interactive claim-entry navigation asks the person to pick the program and open the claim page
- **THEN** the app notices within 2 seconds and continues
