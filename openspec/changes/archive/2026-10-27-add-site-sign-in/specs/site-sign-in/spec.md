# Spec Delta

## Purpose

Gets the ProRewards tab signed in and onto the month's claim page with as little effort from the person as is
safe.

## ADDED Requirements

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
When the tab shows the site's login page and a password is saved, the app SHALL fill the email and password and
click Log in, once. If the login page is still showing after 20 seconds, it SHALL stop and say: "The website did
not finish signing in (wrong password, a code, or a CAPTCHA?). Finish signing in in the ProRewards tab." It SHALL
not try again until the person asks.

#### Scenario: Cookies still valid
- **WHEN** the app starts and the site's login is still valid
- **THEN** the saved password is not used

#### Scenario: Wrong password
- **WHEN** the saved password is wrong
- **THEN** the app tries once, stops with the message above, and the ProRewards screen opens so the person can finish

#### Scenario: No saved password
- **WHEN** the site shows its login page and no password is saved
- **THEN** the app shows the ProRewards screen and asks the person to sign in there

### Requirement: Open the month's claim page
When the person clicks Match tires and the claim page is not open, the app SHALL go to Submit Sale, choose the one
program whose name contains the month's name and year, click that step's Next, and wait up to 15 seconds for the
claim page. It SHALL never click a button on the claim page itself. Otherwise it SHALL ask the person to finish in
the tab, and continue by itself once the claim page is showing.

#### Scenario: Program found
- **WHEN** the month is September 2026 and Submit Sale lists "September 2026 Pro Rewards" once
- **THEN** the app picks it, clicks Next, and continues to matching when the claim page appears

#### Scenario: Program not listed
- **WHEN** no program contains "September 2026"
- **THEN** the app says "This month's program is not in the list on the website. Pick the program in the ProRewards tab." and waits

#### Scenario: Person finishes by hand
- **WHEN** the person picks the program and opens the claim page themselves
- **THEN** the app notices within 2 seconds and continues

### Requirement: Sign-in state shown
The sidebar SHALL show whether the tab is signed in. The Sales screen's ProRewards card SHALL show the sign-in
state and, once the claim page has been read, the program, its dates and the number of tires.

#### Scenario: Signed out
- **WHEN** the tab is on the login page
- **THEN** the sidebar shows "Signed out" and the Sales screen's card offers Sign in
