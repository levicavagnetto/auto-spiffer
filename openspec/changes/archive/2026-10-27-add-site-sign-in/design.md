# Design

## Context

Login selectors and the program-choice guesses are in `docs/site-reference.md`. The old flow is
`git show origin/legacy:auto_spiffer/login.py` (`login_and_navigate`, `_choose_program`, `_open_claim_form`,
`pick_program`). The tab's persistent session is from change 02.

## Goals / Non-Goals

**Goals:** zero clicks on a normal month; a clean hand-off to the person whenever anything is unexpected.

**Non-Goals:** codes, CAPTCHAs, password resets, more than one account.

## Decisions

### D1. Credentials
Email in electron-store; password as `safeStorage.encryptString(...)` base64 in electron-store. Refuse to save when
`safeStorage.isEncryptionAvailable()` is false. The decrypted password exists only inside the sign-in function and
goes to the page through `executeJavaScript` with JSON-encoded arguments. Log lines never include it.

### D2. Detecting where the tab is
A small `whereAmI()` in the page: `login` (the password box is present), `claim` (the claim page check from
change 02), `program-choice` (Submit Sale without the claim controls), `other`. Polled every 2 s while waiting for
the person, and after every navigation.

### D3. Sign in
Fill `#UserLogin_UserName` and `#UserLogin_Password` with the controls' values and `input` events, then
`guardedClick('#UserLogin_Login')`. Wait up to 20 s for `whereAmI() !== 'login'`.

### D4. Program choice
Build against the saved page once it exists. Try, in order: the Chosen widget as a person uses it (open, click
the one matching entry), then the hidden `<select>` (set the value, fire `change`, `chosen:updated`). Match with the
month name and year, case-insensitive; exactly one match or stop. Then the one visible button or link whose text
is `Next`, only when `whereAmI() === 'program-choice'`; wait for `claim`.

### D5. Stay signed in off
On `before-quit`, `session.fromPartition('persist:prorewards').clearStorageData()`.

## Risks / Trade-offs

- The program page's real structure is not yet seen. D4 follows the old app's working guesses; the saved page
  decides.
