---
title: Stored login and auto-navigate - Plan
type: feat
date: 2026-10-07
topic: auto-login-navigate
---

# Stored login and auto-navigate - Plan

## Goal

- **Objective:** After "Open claim site", the app logs in with credentials the user saved once, goes to the Submit a Sales Claim page, and selects the program that matches the loaded month. If anything goes wrong or it cannot decide, it stops and leaves the browser at that page for the user.
- **Approach:** Save the username in `data/settings.json` and the password in Windows Credential Manager (`keyring`). Add a "login and navigate" step to the browser thread that runs after the first `goto`. It uses selectors from `config.toml`, is fully optional, and never raises. It only reports a note.
- **Open blockers:** The login page and the program/month picker on `submitsale.aspx` have not been seen. T1 asks the user to save both pages as HTML into `tests/fixtures/` so the selectors are written against real markup, not guessed.

## Product Contract

### Summary
Today `BrowserSession._main` opens `live_url` and the Run page tells the user to log in and click Claims > Submit a Sales Claim. This feature does both steps. It adds a Settings section to store credentials (opt-in), and a navigation step that ends on `https://prorewards.acbrewards.com/authorized/claims/submitsale.aspx` with the right month's program chosen.

### Problem Frame
Each month the user opens the site, types a username and password, finds the claim page, and picks the program before clicking step 2. `docs/DESIGN.md` (non-goals line 43, assumptions line 359) deliberately left login to the person to avoid storing a password and to leave MFA/CAPTCHA to a human. The user has now decided to store credentials, so those lines must be updated. The "wait for the human" fallback is kept, so MFA or a CAPTCHA does not break anything.

### Requirements
- R1. Settings has a "Saved login" section: username and password boxes, a Save button, and a Forget button. It is off until the user fills it in.
- R2. The password is stored only in Windows Credential Manager. It is never written to `settings.json`, `config.toml`, logs, the run CSV, or any month folder.
- R3. With saved credentials, "Open claim site" logs in on the real site without the user typing.
- R4. After login, the app navigates to `submitsale.aspx` and selects the program matching the loaded month's report.
- R5. Without saved credentials, behavior is exactly as today (the user logs in and navigates).
- R6. Any failure (bad password, MFA, CAPTCHA, missing element, timeout, unmatched month) leaves the browser open on the best page reached, writes a plain-language note to the Run log, and never blocks step 2.
- R7. Test mode never logs in and never touches the network.
- R8. No credential is ever shown in the Run log, and the app never auto-retries a failed login (avoids account lockout).
- R9. The never-click list still applies. The navigation step clicks only login, menu or program-select controls, never Next, Save Claim or Submit.

### Key Decisions
- Password in Windows Credential Manager via `keyring` (user chose this).
- If login fails, the page cannot be reached, or the month is undecidable: wait at the page and let the user finish (user's choice). No MFA-specific code beyond this.
- Program is chosen by matching the loaded month's promotion (user chose this). If there is no loaded month or no confident match, stop at the picker.
- Credentials are opt-in. Nothing is stored unless the user presses Save.

### Acceptance Examples
- AE1. **Covers R1, R2.** Given the user saves a username and password, when they open `data\` and `settings.json`, then the username is there and the password is nowhere. The password appears in Credential Manager under "Auto Spiffer".
- AE2. **Covers R3, R4.** Given saved credentials and the September report loaded, when the user clicks "Open claim site", then the browser logs in, lands on `submitsale.aspx`, and has the September program selected.
- AE3. **Covers R5.** Given no saved credentials, when the user clicks "Open claim site", then the browser opens the site and the log tells the user to log in, as today.
- AE4. **Covers R6, R8.** Given a wrong saved password, when the user clicks "Open claim site", then the browser stays on the login page, the log says the login did not work and to log in by hand, and no second attempt is made.
- AE5. **Covers R6.** Given the month cannot be matched to a program, then the browser waits on `submitsale.aspx` and the log says to pick the program.
- AE6. **Covers R7.** Given test mode on, when the user clicks "Open claim site", then the saved page opens and no login is attempted.

### Scope Boundaries
- Not doing: MFA/CAPTCHA solving or detection beyond "login did not finish, so wait".
- Not doing: keeping the login across app restarts (the browser profile is still fresh each time).
- Not doing: filling or clicking anything on the claim form during navigation. That stays in `fill.py`.
- Deferred: a "log in only" button, multiple saved accounts.

### Dependencies / Assumptions
- `keyring` added to `requirements.txt` and to the PyInstaller build (the Windows backend must be bundled: check `build_exe.py`).
- Login form and program picker markup come from the saved pages in T1.
- `data/` is git-ignored, so no credential file can be committed.

## Planning Contract

### Key Technical Decisions
- KTD1. New module `auto_spiffer/login.py`: `save_credentials`, `load_credentials`, `forget_credentials`, plus `login_and_navigate(page, cfg, creds, month)` that returns a result (`ok` / `stopped` + message). Rejected: putting this in `browser.py`, which stays a thin thread owner and keeps the Playwright code testable. Governs R2, R3, R4, R6.
- KTD2. The username lives in `settings.json` (key `login_user`). Only the password goes to `keyring`. Governs R2.
- KTD3. New `[login]` section in `config.toml` (login URL, selectors for username, password, submit, logged-in marker, program picker, and the claim page URL), following the existing "fix the site in config, not code" idea. Existing user `config.toml` files lack the section, so `load_config` falls back to defaults. Governs R3, R4.
- KTD4. `BrowserSession` gets optional `credentials` and `month` arguments. `_main` calls `login_and_navigate` after `goto` inside a try/except that records the note, never raising. Notes are exposed through an attribute the Run page reads in `opened()`. Governs R5, R6, R7.
- KTD5. Month-to-program matching reuses the promotion name read by `ClaimPage.promotion()` / `FillConfig` logic and `workspace.Workspace.month`. The exact option text format is decided after T1. Governs R4.

### Where it fits
- `auto_spiffer/browser.py:152` (the live `goto`) is where login and navigate is invoked.
- `auto_spiffer/gui/pages/run.py:155` is the message that tells the user to log in by hand. It becomes conditional.
- `auto_spiffer/gui/settings_dialog.py` gets the Saved login section. The window height (470) needs raising.
- `auto_spiffer/fill.py` `FillConfig` / `load_config` gets the `[login]` section.
- `auto_spiffer/settings.py` gets the `login_user` default.
- `auto_spiffer/defaults/config.toml` gets the `[login]` section. `tests/fixtures/` gets the two saved pages.
- `docs/DESIGN.md` lines 43, 57, 359 updated. `README.md` "Every month" section updated.

## Implementation Units

### U1. Capture the real pages
- **Goal:** Real markup for the login page and the program picker.
- **Requirements:** R3, R4
- **Dependencies:** none
- **Files:** `tests/fixtures/` (new files, saved by the user)
- **Approach:** User saves the login page and `submitsale.aspx` (before a program is chosen) with Ctrl+S. Credentials in them must not be saved, so save before typing.
- **Test scenarios:** Files open in a browser and show the form and the picker.
- **Verification:** I can read the field ids and the program option text from the files.

### U2. Credential storage
- **Goal:** Save, load and forget credentials safely.
- **Requirements:** R1, R2
- **Dependencies:** none
- **Files:** `auto_spiffer/login.py` (new), `auto_spiffer/settings.py`, `requirements.txt`, `tests/test_login.py` (new)
- **Approach:** 1. Add `keyring`. 2. Functions for password via `keyring` and username via `Settings`. 3. A fake in-memory keyring in tests.
- **Test scenarios:** Round-trip. Forget removes it. Missing keyring backend returns no credentials, no crash. Password never appears in `settings.json`.
- **Verification:** `pytest tests/test_login.py`.

### U3. Login config section
- **Goal:** Selectors and URLs in `config.toml`.
- **Requirements:** R3, R4, R5
- **Dependencies:** U1
- **Files:** `auto_spiffer/defaults/config.toml`, `auto_spiffer/fill.py`, `tests/test_fill.py`
- **Approach:** Add `[login]`. Parse into `FillConfig.login` with defaults when the section is missing.
- **Test scenarios:** Old config without `[login]` still loads. New default parses.
- **Verification:** Existing config tests still pass plus a new one.

### U4. Login and navigate step
- **Goal:** Log in and reach the claim page with the right program.
- **Requirements:** R3, R4, R6, R8, R9
- **Dependencies:** U1, U2, U3
- **Files:** `auto_spiffer/login.py`, `tests/test_login.py`
- **Approach:** 1. Detect the login form. 2. Fill and submit once. 3. Wait for the logged-in marker, else stop with a message. 4. Go to `submitsale.aspx`. 5. Pick the program matching the month, else stop with a message.
- **Test scenarios:** Against the saved pages with a stub server or route interception: success, wrong password, form missing, no matching program.
- **Verification:** Tests pass and nothing is clicked from `never_click`.

### U5. Wire into the browser session and Run page
- **Goal:** "Open claim site" does it all.
- **Requirements:** R3, R5, R6, R7
- **Dependencies:** U4
- **Files:** `auto_spiffer/browser.py`, `auto_spiffer/gui/pages/run.py`, `tests/test_run_page.py`
- **Approach:** Pass credentials and the workspace month to `BrowserSession`. Skip in test mode. Log the result note.
- **Test scenarios:** No credentials means old message. Test mode skips. Failure note shows in the log and step 2 still works.
- **Verification:** Existing run page tests pass, plus new ones.

### U6. Settings UI
- **Goal:** The user can save and forget credentials.
- **Requirements:** R1, R2
- **Dependencies:** U2
- **Files:** `auto_spiffer/gui/settings_dialog.py`, `tests/test_gui.py`
- **Approach:** Username entry, masked password entry (never prefilled), Save and Forget buttons, a "Saved login: yes/no" label.
- **Test scenarios:** Save then reopen shows "yes" and the username but a blank password box. Forget clears.
- **Verification:** GUI tests plus a manual look.

### U7. Docs and packaging
- **Goal:** Docs match, and the .exe contains `keyring`.
- **Requirements:** R2
- **Dependencies:** U5, U6
- **Files:** `docs/DESIGN.md`, `README.md`, `build_exe.py`
- **Approach:** Update the non-goal and assumption lines. Add the README step. Make sure PyInstaller bundles the keyring Windows backend.
- **Verification:** The built .exe can save and read a credential.

## Verification Contract

AE1 to AE6 are checked by the user in the final task. Automated tests cover U2 to U6 with a fake keyring and saved pages, so no real login happens in tests. The live trial uses the user's real account once.

## Definition of Done

- All tests pass (`.venv\Scripts\python.exe -m pytest`).
- The live trial reaches the right program, and a wrong-password trial stops cleanly.
- The password is verifiably absent from `data\`, logs and CSVs.
- Docs updated and no debug code left.

## Task List

Work top to bottom. Each task is built, then tested by the user, before the next starts.

- [ ] **T1. Save the two real pages** *(layer: state)*
  - **BUILD:** `USER:` In Chrome, log out, open the site and Ctrl+S the login page as "Webpage, Complete" into `tests/fixtures/` named `ATD Login.html`. Do this before typing anything. Then log in, open `https://prorewards.acbrewards.com/authorized/claims/submitsale.aspx` and save it as `ATD Submit Sale Picker.html`, again into `tests/fixtures/`. I then read both and note the field ids and program text.
  - **TEST:** Open each saved file in the browser -> the first shows the login form, the second shows the program/month choices | Failure looks like: the picker file shows the claim form instead of a program list (then tell me how you get to the picker).
- [ ] **T2. Add `keyring` and credential storage** *(layer: state)*
  - **BUILD:** Add `keyring` to `requirements.txt`. Create `auto_spiffer/login.py` with save, load and forget (password in Credential Manager, username in `settings.json`). Add `tests/test_login.py` using a fake keyring.
  - **TEST:** Run `.venv\Scripts\python.exe -m pip install -r requirements.txt` then `.venv\Scripts\python.exe -m pytest tests/test_login.py` -> all pass | Failure looks like: install error or a failing test, send me the output.
- [ ] **T3. Add the `[login]` config section** *(layer: state)*
  - **BUILD:** Add `[login]` to `auto_spiffer/defaults/config.toml` and parse it in `fill.py` with fallback defaults when it is absent. Selectors come from T1.
  - **TEST:** Run `.venv\Scripts\python.exe -m pytest tests/test_fill.py` -> all pass, including a new test that an old `config.toml` without `[login]` still loads | Failure looks like: "config.toml could not be read".
- [ ] **T4. Login step** *(layer: logic)*
  - **BUILD:** In `login.py`, add the part that detects the login form, fills the saved credentials, submits once, and waits for a logged-in marker. It returns a result with a plain message and never raises. Tests run against the saved login page.
  - **TEST:** Run `.venv\Scripts\python.exe -m pytest tests/test_login.py` -> success and wrong-password cases pass, and the wrong-password case makes exactly one attempt | Failure looks like: a test failing or hanging.
- [ ] **T5. Navigate and pick the program** *(layer: logic)*
  - **BUILD:** In `login.py`, go to `submitsale.aspx` and choose the program that matches the month. Stop with a message if there is no month or no confident match. Tests use the saved picker page.
  - **TEST:** Run `.venv\Scripts\python.exe -m pytest tests/test_login.py` -> matching, no-match and no-month cases pass | Failure looks like: the wrong program chosen in a test.
- [ ] **T6. Wire into the browser and Run page** *(layer: wiring)*
  - **BUILD:** `BrowserSession` takes credentials and month, runs the step after `goto` (skipped in test mode), and exposes the note. `run.py` passes them in and writes the note instead of the "log in by hand" text when a login was tried.
  - **TEST:** Run `.venv\Scripts\python.exe -m pytest` -> everything passes. Then run the app with no saved login and click Open claim site -> the old message appears | Failure looks like: an existing test failing, or a changed message when nothing is saved.
- [ ] **T7. Saved login in Settings** *(layer: visuals)*
  - **BUILD:** Add the Saved login section to `settings_dialog.py` (username, masked password, Save, Forget, status label) and enlarge the window to fit. Add GUI tests.
  - **TEST:** Run the app, open Settings, save a login, close and reopen -> the username and "Saved login: yes" show, the password box is empty. Click Forget -> it shows "no" | Failure looks like: the password visible anywhere, or buttons cut off.
- [ ] **T8. Docs and packaging** *(layer: polish)*
  - **BUILD:** Update `docs/DESIGN.md` (lines 43, 57, 359) and the README monthly steps. Check `build_exe.py` bundles the keyring Windows backend.
  - **TEST:** Run `.venv\Scripts\python.exe build_exe.py`, start the built `AutoSpiffer.exe`, save and forget a login in Settings -> works with no error | Failure looks like: "No recommended backend" or a crash on Save.
- [ ] **T9. Full-feature check** *(layer: polish)*
  - **BUILD:** `USER:` Run AE1 to AE6 on the real site. Load the September report, click Open claim site with saved credentials. Then try a wrong password, then test mode, then no saved login.
  - **TEST:** AE1 password only in Credential Manager. AE2 lands logged in on the right program. AE3 old behavior. AE4 stays on the login page, one attempt only. AE5 waits at the picker with a note. AE6 saved page, no login | Failure looks like: any password found in `data\`, a second login attempt, or the app clicking past the picker.
