# site-sign-in Specification

## Purpose

Gets the ProRewards tab signed in and onto the month's claim page with as little effort from the person as is
safe.

## Requirements

### Requirement: Stay signed in
With **Stay signed in** on (the default), the site's login SHALL survive closing and reopening the app for as long
as the site allows. With it off, the app SHALL clear the site's cookies and storage when it closes.

#### Scenario: Turned off
- **WHEN** the person turns off Stay signed in and restarts the app
- **THEN** the tab opens on the site's login page

### Requirement: Saved password
The person SHALL be able to save an email and password in Settings. The password SHALL be stored only encrypted
with the Windows account, never in plain text, never in logs, and never sent to the screens after saving (the
screen only learns that one is saved). **Sign out and forget password** SHALL delete the saved password, clear the
site's cookies, and load the login page.

#### Scenario: Password saved
- **WHEN** the person saves a password
- **THEN** Settings shows "Saved, encrypted with your Windows account" and the settings file does not contain the password text

#### Scenario: Encryption not available
- **WHEN** Windows cannot encrypt the password
- **THEN** the app does not save it and says the password cannot be stored safely on this computer

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

### Requirement: Sign-in state shown
The sidebar SHALL show whether the tab is signed in. The Sales screen's ProRewards card SHALL show the sign-in
state and, once the claim page has been read, the program, its dates and the number of tires.

#### Scenario: Signed out
- **WHEN** the tab is on the login page
- **THEN** the sidebar shows "Signed out" and the Sales screen's card offers Sign in
