# Spec Delta

## MODIFIED Requirements

### Requirement: Never submit
The run SHALL never click Next, Back, Submit, Save Claim or Yes on the claim page. Navigation MAY click the program-choice page's Next control only after selecting the unique program for the intended month. The run SHALL answer No to the site's duplicate warning and SHALL leave the claim page scrolled to the top and the tab shown when it ends.

#### Scenario: End of a run
- **WHEN** the run ends, finished or stopped
- **THEN** the tab shows the claim page from the top, and the screen says to check the page and click Next and Submit on the website

### Requirement: Check the page before typing
Before entering anything, the app SHALL open the month's claim page if needed, then confirm that its promotion is the month's program, every line's sale date is inside the program dates, and every line's tire is in the product list. If navigation or any check fails, it SHALL enter nothing and say plainly what is wrong and what to do. A page check requested after a run SHALL use the same recovery and validation.

#### Scenario: Wrong program
- **WHEN** the lines are for September 2026 and the page's promotion is October 2026 Pro Rewards
- **THEN** the app tries to open the September program, then checks that page before entering; if it cannot, nothing is entered and the app explains what needs attention

#### Scenario: Page check passes
- **WHEN** the program, dates and tires all match after any needed navigation
- **THEN** the screen shows "Page check passed" with the program and date range, and the run starts

#### Scenario: Start after visiting Home
- **WHEN** the person matched tires, visited ProRewards Home, then clicks Start entering
- **THEN** the app returns to that month's claim page, checks it, and begins only when the check passes

#### Scenario: Check page and run again after visiting another page
- **WHEN** a run has finished, the person visits another ProRewards page, then clicks Check page and run again
- **THEN** the app returns to the month's claim page, rechecks it, and skips any already-entered lines visible in its sale list

### Requirement: One run at a time, with guards
The app SHALL refuse to start a run while one is going or with no ready lines. When the tab is not on the month's claim page, it SHALL attempt safe navigation before starting and SHALL enter nothing unless the page check passes. Closing the app during a run SHALL ask first; if confirmed, the current line finishes and the run stops. The window SHALL stay usable during a run.

#### Scenario: Nothing to enter
- **WHEN** no line is ready
- **THEN** Start entering is disabled with "No sales are ready to enter"

#### Scenario: Close during a run
- **WHEN** the person closes the window during a run
- **THEN** the app asks "A claim is being entered. Stop after this line and close?" and only closes after the line finishes

#### Scenario: Cannot reach the claim page
- **WHEN** the app cannot safely open and verify the month's claim page
- **THEN** the run does not start, no line or PDF is sent, and the screen says what the person must do in the ProRewards tab

## ADDED Requirements

### Requirement: Recover the claim page during a run
Before each line or PDF action, the app SHALL confirm that it is on the verified month's claim page. If the tab moved, it SHALL navigate back and repeat the relevant page and duplicate checks before acting. It SHALL not continue automatically when the recovered page cannot be verified as the same claim being entered.

#### Scenario: Person leaves the page between lines
- **WHEN** the person navigates to Home after one sale and before the next sale
- **THEN** the app returns to the month's claim page, confirms the earlier sale is still visible, and checks the next sale against the live list before entering it

#### Scenario: Page changed before PDF upload
- **WHEN** the site is no longer on the claim page after an invoice's sale was added but before its PDF upload
- **THEN** the app returns to the month's claim page and confirms that sale is still visible before uploading the PDF once

#### Scenario: Recovered page does not show this run's sale
- **WHEN** the app reopens the month's claim page but a sale it added earlier in this run is missing from the page's sale list
- **THEN** it stops automatic entry, reports that the claim page needs review, and does not add another line or upload a PDF

#### Scenario: Login or site navigation cannot finish
- **WHEN** sign-in or program navigation does not reach a verifiable claim page
- **THEN** the app stops automatic entry and asks the person to finish on the ProRewards tab without guessing, submitting, or retrying the password indefinitely
