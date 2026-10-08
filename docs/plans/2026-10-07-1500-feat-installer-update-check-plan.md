---
title: Installer and update check - Plan
type: feat
date: 2026-10-07
topic: installer-update-check
---

# Installer and update check - Plan

## Goal

- **Objective:** Users install Auto Spiffer with a normal Windows setup wizard, and the app tells them when a newer GitHub release exists and lets them open its download page.
- **Approach:** Wrap the existing PyInstaller folder in an Inno Setup installer built by the release workflow. Add a small background update check that compares `__version__` with the latest GitHub release and shows a notice with an "Update" button that opens the release page.
- **Open blockers:** None. The repo is public (checked with `gh`), so the unauthenticated releases API works.

## Product Contract

### Summary

Two parts: (1) `AutoSpiffer-Setup-vX.Y.Z.exe`, a per-user installer published with every release; (2) an update notice inside the app. Downloading and installing the update from inside the app is deliberately left out for now.

### Problem Frame

Today a release is a zip of `dist/AutoSpiffer` (see `.github/workflows/release.yml`). The user unzips it, has no Start Menu entry or uninstaller, and has no way to learn about new versions. The app keeps `data/` and `output/` next to the exe (`auto_spiffer/paths.py`), so the install folder must be writable. That rules out `C:\Program Files` unless the data moves.

### Requirements

- R1. A release produces `AutoSpiffer-Setup-vX.Y.Z.exe` (wizard: welcome, folder, optional desktop shortcut, finish with "Launch Auto Spiffer").
- R2. Install is per-user, needs no admin rights, and defaults to `%LOCALAPPDATA%\Programs\Auto Spiffer`.
- R3. A Start Menu shortcut and an entry in Windows "Apps & features" (uninstaller) are created.
- R4. Installing a newer version over an older one keeps the user's `data/` (settings, catalog, history, state). Uninstalling does not delete `data/` or `output/`.
- R5. The release still attaches the zip, plus the installer.
- R6. On startup the app checks the latest GitHub release in the background. It never delays or blocks startup, and any failure (offline, rate limit, bad reply) is silent.
- R7. If the latest release is newer than `__version__`, the app shows "Version X is available" with an "Update" button that opens the release page in the browser. If the app is up to date, nothing is shown.
- R8. Settings has a switch "Check for updates" (default on). When off, the app makes no network call for this.
- R9. Prereleases and drafts are ignored (the GitHub `releases/latest` endpoint already excludes them).

### Key Decisions

- Inno Setup, per-user install (user chose to plan installer + notice only; option 1 "open the release page", 2026-10-07).
- In-app download and silent install is out of scope.

### Acceptance Examples

- AE1. **Covers R1-R3.** Given the new installer, when run on a clean PC, then the wizard installs the app, a Start Menu shortcut launches it, and it appears in Apps & features.
- AE2. **Covers R4.** Given an install with saved settings, when a newer installer runs over it, then the app starts with the same settings and months.
- AE3. **Covers R6, R7.** Given `__version__` is 0.2.1 and the latest release is v0.3.0, when the app starts, then the notice appears and "Update" opens the release page.
- AE4. **Covers R6.** Given no internet, when the app starts, then it starts normally with no notice and no error.
- AE5. **Covers R8.** Given "Check for updates" is off, when the app starts, then no request is sent.

### Scope Boundaries

- Not doing: downloading or running the update from inside the app (deferred to a follow-up).
- Not doing: code signing. The installer shows a Windows SmartScreen warning until a certificate is bought.
- Not doing: moving `data/` to `%APPDATA%`. Per-user install makes it unnecessary.
- Not doing: checking for updates more than once per launch, or a "skip this version" button.

### Dependencies / Assumptions

- Inno Setup 6 on the GitHub `windows-latest` runner (installed with `choco install innosetup` if missing).
- The release tag format stays `vX.Y.Z`, already enforced by the workflow.
- Standard library only for the HTTP call (`urllib.request`), so no new Python dependency.

## Planning Contract

### Key Technical Decisions

- KTD1. Inno Setup over MSI/WiX or NSIS: simplest script, wizard and uninstaller for free, easy in CI. Governs R1-R4.
- KTD2. `PrivilegesRequired=lowest` and `{autopf}` with a per-user default, with a fixed `AppId` GUID so upgrades replace the previous install. Governs R2, R4.
- KTD3. The installer script only installs files from `dist/AutoSpiffer` and never lists `data/` or `output/` in `[UninstallDelete]`, so user data survives. Governs R4.
- KTD4. Version passed in from CI (`/DAppVersion=0.2.1`) so the script has no hardcoded version. Governs R1.
- KTD5. Update check is a pure module (`auto_spiffer/updates.py`) with injectable URL and fetch function, so tests use a local HTTP server instead of the real GitHub. Governs R6, R9.
- KTD6. Versions are compared as integer tuples parsed from `vX.Y.Z`. Anything that does not parse is treated as "not newer". Governs R7.
- KTD7. The check runs on the existing `Worker` thread helper, and the result is applied on the Tk thread. Governs R6.

### Where it fits

- `installer/auto_spiffer.iss` (new): the Inno Setup script.
- `.github/workflows/release.yml`: add install-Inno, build-installer and attach-installer steps.
- `auto_spiffer/updates.py` (new): version parsing, `latest_release()`, `is_newer()`.
- `auto_spiffer/settings.py`: new default `check_updates: True`.
- `auto_spiffer/gui/app.py`: start the check after the window shows; notice in the sidebar footer (near `tire_status`).
- `auto_spiffer/gui/settings_dialog.py`: the "Check for updates" checkbox.
- `README.md`, `docs/DESIGN.md`: install and update notes.
- Tests: `tests/test_updates.py` (new), additions to `tests/test_gui.py`, `tests/test_session.py` (settings default).

## Implementation Units

### U1. Installer script
- **Goal:** A working per-user wizard installer built locally.
- **Requirements:** R1-R4
- **Dependencies:** none
- **Files:** `installer/auto_spiffer.iss` (new)
- **Approach:** 1. App name, publisher, fixed `AppId`, `AppVersion={#AppVersion}`. 2. `PrivilegesRequired=lowest`, default dir under `{localappdata}\Programs`. 3. `[Files]` copies `dist\AutoSpiffer\*` recursively. 4. Start Menu icon, optional desktop icon task, `[Run]` launch after install. 5. Icon from `assets\icon.ico`. 6. Output `AutoSpiffer-Setup-v{#AppVersion}.exe`.
- **Test scenarios:** Fresh install; install over an older one with data present; uninstall; run with a folder name that has spaces.
- **Verification:** AE1, AE2.

### U2. Build the installer in the release workflow
- **Goal:** Each tag publishes the installer next to the zip.
- **Requirements:** R1, R5
- **Dependencies:** U1
- **Files:** `.github/workflows/release.yml`
- **Approach:** After the exe build: ensure Inno Setup is available, run `iscc /DAppVersion=<version> installer\auto_spiffer.iss`, add the installer to `gh release create`.
- **Test scenarios:** A tag run produces both assets; a failed `iscc` fails the job.
- **Verification:** The release page lists the zip and `AutoSpiffer-Setup-vX.Y.Z.exe`.

### U3. Update checker module
- **Goal:** Pure logic to decide whether a newer release exists.
- **Requirements:** R6, R7, R9
- **Dependencies:** none
- **Files:** `auto_spiffer/updates.py` (new), `tests/test_updates.py` (new)
- **Approach:** 1. `parse_version("v0.2.1") -> (0,2,1)`, `None` if invalid. 2. `is_newer(latest, current)`. 3. `latest_release(url, timeout=5)` returns `(tag, html_url)` or `None` on any error. 4. Default URL is the GitHub API for this repo.
- **Test scenarios:** newer, same, older, invalid tags, `v0.10.0` vs `v0.9.0`; local HTTP server returning valid JSON, 404, invalid JSON, a hang (timeout).
- **Verification:** `pytest tests/test_updates.py`.

### U4. Setting and Settings switch
- **Goal:** Let the user turn the check off.
- **Requirements:** R8
- **Dependencies:** none
- **Files:** `auto_spiffer/settings.py`, `auto_spiffer/gui/settings_dialog.py`, tests
- **Approach:** Add `check_updates` default `True`; add a checkbox in the dialog's most fitting section with a short label, "Check for updates".
- **Test scenarios:** Default is on; saving off persists; an old settings file without the key gets the default.
- **Verification:** AE5 setting half.

### U5. Show the notice in the app
- **Goal:** Start the check at launch and show the notice.
- **Requirements:** R6, R7, R8
- **Dependencies:** U3, U4
- **Files:** `auto_spiffer/gui/app.py`, `tests/test_gui.py`
- **Approach:** 1. After startup, if the setting is on, run `latest_release` on the worker. 2. If newer, show a small label "Version X is available" and an "Update" button in the sidebar footer. 3. "Update" calls `webbrowser.open(url)`. 4. No widget shown on failure or when up to date. 5. Tests inject a fake fetch and a fake browser opener; the tests must never touch the network.
- **Test scenarios:** Newer shows notice; same/older/failure shows none; setting off makes no call; Update opens the right URL; window still fits at minimum size.
- **Verification:** AE3, AE4, AE5.

### U6. Docs
- **Goal:** Tell users how to install and update.
- **Requirements:** R1, R7
- **Dependencies:** U1-U5
- **Files:** `README.md`, `docs/DESIGN.md`
- **Approach:** Replace the "unzip" instructions with the installer, mention the SmartScreen warning, the update notice, and the setting. Update the release steps (installer asset).

## Verification Contract

The user runs the full test suite and the manual checks: AE1 and AE2 on a PC (a fresh Windows user or VM is ideal), AE3 by temporarily lowering `__version__` or pointing the URL at a local server, AE4 by turning the network off. CI building both assets is checked on the next real release.

## Definition of Done

- [ ] Installer installs, upgrades and uninstalls as described, and keeps `data/`.
- [ ] A tag push publishes the zip and the installer.
- [ ] Update notice appears only when a newer release exists; failures are silent.
- [ ] "Check for updates" off means no request.
- [ ] No test touches the real network.
- [ ] README and DESIGN updated; no leftover debug code.

## Task List

Work top to bottom. Each task is built, then tested by the user, before the next starts.

- [x] **T1. Update checker logic** *(layer: logic)*
  - **BUILD:** Add `auto_spiffer/updates.py` (`parse_version`, `is_newer`, `latest_release`) and `tests/test_updates.py` using a local HTTP server.
  - **TEST:** Run `.venv\Scripts\python.exe -m pytest tests/test_updates.py` -> all pass, finishing in a few seconds | Failure looks like: a failing test name and its assertion.
- [x] **T2. "Check for updates" setting** *(layer: state)*
  - **BUILD:** Add the `check_updates` default in `auto_spiffer/settings.py` and its tests.
  - **TEST:** Run `.venv\Scripts\python.exe -m pytest tests/test_session.py -k settings` -> pass | Failure looks like: a test name mentioning `check_updates`.
- [x] **T3. Settings dialog checkbox** *(layer: visuals)*
  - **BUILD:** Add the "Check for updates" checkbox to `auto_spiffer/gui/settings_dialog.py`, wired to the setting.
  - **TEST:** Run `.venv\Scripts\python.exe -m auto_spiffer`, open Settings, untick the box, Save, reopen -> it stays off; the dialog still looks tidy and fits | Failure looks like: the box resets, or the layout is cramped or cut off (send a screenshot).
- [x] **T4. Startup check and sidebar notice** *(layer: wiring)*
  - **BUILD:** In `auto_spiffer/gui/app.py`, run the check at launch and show the notice with the "Update" button; add GUI tests with a fake fetch and fake browser opener.
  - **TEST:** Run `.venv\Scripts\python.exe -m pytest tests/test_gui.py -k update`; then start the app with `__version__` temporarily set to `0.0.1` -> the notice shows, "Update" opens the latest release page; with the real version (or setting off) -> no notice | Failure looks like: no notice, a crash at startup, or the notice cut off in the sidebar.
- [x] **T5. Offline behavior** *(layer: polish)*
  - **BUILD:** None expected; this task is a check of the failure paths from T4 (add handling if the check shows a gap).
  - **TEST:** Turn Wi-Fi off, start the app -> it opens at normal speed with no notice and no error dialog | Failure looks like: a delay at startup, an error message, or a traceback in the console.
- [x] **T6. Installer script** *(layer: wiring)*
  - **BUILD:** USER: install Inno Setup 6 (`winget install JRSoftware.InnoSetup`). Then add `installer/auto_spiffer.iss`.
  - *Note:* the script excludes `data\` and `output\` from the files it ships (they appear in `dist\` if the built exe is run there), and sets `AppVerName` so Windows shows "Auto Spiffer 0.2.1" instead of "Auto Spiffer version 0.2.1".
  - **TEST:** Run `.venv\Scripts\python.exe build_exe.py`, then `iscc /DAppVersion=0.2.1 installer\auto_spiffer.iss` -> `installer\Output\AutoSpiffer-Setup-v0.2.1.exe` exists; run it -> wizard installs under `%LOCALAPPDATA%\Programs\Auto Spiffer`, Start Menu shortcut launches the app, the app appears in Apps & features | Failure looks like: `iscc` errors (paste them), a missing file at launch, or a UAC admin prompt appearing.
- [x] **T7. Upgrade and uninstall keep data** *(layer: polish)*
  - **BUILD:** Adjust the script if the check fails.
  - **TEST:** With the app installed, change a setting and load a month; run the installer again (same version is fine) -> settings and months are still there; uninstall -> the `data` folder is still in the install folder | Failure looks like: settings reset after upgrade, or `data` deleted on uninstall.
- [ ] **T8. Build the installer in the release workflow** *(layer: wiring)*
  - **BUILD:** Update `.github/workflows/release.yml` to build the installer and attach it with the zip. Add `installer/Output/` to `.gitignore` if needed.
  - **TEST:** USER: push a test tag after the next version bump (for example `v0.2.2` or a prerelease like `v0.3.0-rc1`) -> the Actions run is green and the release lists the zip and `AutoSpiffer-Setup-vX.Y.Z.exe` | Failure looks like: a red step in Actions (paste the log of that step).
- [ ] **T9. Docs** *(layer: polish)*
  - **BUILD:** Update `README.md` and `docs/DESIGN.md` (install, update notice, setting, release steps).
  - **TEST:** Read the new README section -> a new user could install and update from it alone | Failure looks like: an unclear or wrong step.
- [ ] **T10. Full-feature check** *(layer: polish)*
  - **BUILD:** None; run the Definition of Done.
  - **TEST:** Run `.venv\Scripts\python.exe -m pytest` -> everything passes; then install from the released installer, then publish a newer release (or point at a local server) -> the installed app shows the update notice | Failure looks like: any failing test, or no notice in the installed app.
