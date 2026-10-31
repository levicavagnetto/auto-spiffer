# app-updates Specification

## Purpose
Installs Auto Spiffer on a shop computer and keeps it current with no effort from the person.

## Requirements

### Requirement: Install
The app SHALL install from one Setup `.exe` for the current Windows user, with no administrator rights, adding
Start Menu and desktop shortcuts, with the Auto Spiffer icon. Uninstalling SHALL remove the program but keep the
person's app data folder (saved matches, settings, sign-in) unless they choose to remove it.

#### Scenario: Install and start
- **WHEN** the person runs the Setup file on a computer without admin rights
- **THEN** the app installs and starts, with the Auto Spiffer icon in the Start Menu and taskbar

#### Scenario: Reinstall keeps data
- **WHEN** the person uninstalls and installs again
- **THEN** their saved matches and settings are still there

### Requirement: Automatic updates
The app SHALL check this repository's GitHub Releases for a newer, non-prerelease version at startup and every
6 hours, when updates are on (the default). It SHALL download a newer version in the background, show "Version X
is ready" in the sidebar, and install it when the app closes or when the person clicks **Restart to update**.
It SHALL never install while a claim is being entered. A failed check or download SHALL be logged and retried at
the next check, without bothering the person.

#### Scenario: Update ready
- **WHEN** version 1.0.1 is released while the person has 1.0.0 open
- **THEN** it downloads in the background and the sidebar shows "Version 1.0.1 is ready" with Restart to update

#### Scenario: During a run
- **WHEN** the person clicks Restart to update while a claim is being entered
- **THEN** the app says it will update when the run ends, and does

#### Scenario: Offline
- **WHEN** the computer is offline at startup
- **THEN** the app starts normally and the check is tried again later

#### Scenario: Updates turned off
- **WHEN** the person turns off automatic updates in Settings
- **THEN** the app only checks when they click Check now

### Requirement: Settings for updates and logs
Settings SHALL show the version and update status, **Check now**, the automatic updates switch, and **Open folder** for the logs. When Check now fails, Settings SHALL show a temporary plain-language error toast without Electron's IPC error wrapper.

#### Scenario: Check now
- **WHEN** the person clicks Check now and no newer version exists
- **THEN** Settings says "Auto Spiffer 1.0.0 · up to date, checked just now"

#### Scenario: Check now in a development build
- **WHEN** the person clicks Check now without installing Auto Spiffer
- **THEN** a temporary toast says exactly "Install Auto Spiffer to check for updates"

### Requirement: Release from a tag
Pushing a tag `vX.Y.Z` SHALL build and publish a GitHub Release with the installer and the update feed, after the
version in `package.json` is confirmed to equal the tag and every check passes. Tags with a suffix
(`v1.1.0-rc1`) SHALL publish prereleases, which installed apps do not update to. Tests that need private data SHALL
be skipped in the release build.

#### Scenario: Version mismatch
- **WHEN** the tag is v1.0.1 and `package.json` says 1.0.0
- **THEN** the workflow fails before building, with a message saying so

### Requirement: Moving from 0.x
The 1.0 release assets SHALL be named so that the 0.x app's updater does not find an installer (it then opens the
release page instead), and installing 1.0 SHALL not change or remove the 0.x program folder or its data. The
README SHALL tell 0.x users to install 1.0 and then uninstall the old Auto Spiffer from Windows Settings, and that
their old saved choices do not carry over.

#### Scenario: 0.x user sees the update
- **WHEN** a 0.4.0 user clicks Update after 1.0.0 is released
- **THEN** the old app opens the 1.0.0 release page, and the README there explains the switch

### Requirement: Development builds do not check updates
An unpackaged development build SHALL NOT contact the update feed at startup, on a schedule, or when the person turns on Install updates automatically. The preference SHALL still be saved and displayed. Check now SHALL continue to explain that Auto Spiffer must be installed to check for updates.

#### Scenario: Turn on automatic updates in development
- **WHEN** the person turns off and then turns on Install updates automatically in a development build
- **THEN** the setting is saved and the update state remains idle without checking the feed
