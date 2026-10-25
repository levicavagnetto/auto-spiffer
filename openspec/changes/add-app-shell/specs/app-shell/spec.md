# Spec Delta

## Purpose

The desktop window that holds every Auto Spiffer screen, and the rules that keep its parts separate and safe.

## ADDED Requirements

### Requirement: Window and navigation
The app SHALL open one window with a sidebar and one screen at a time, as described in `docs/ui.md`. The
sidebar SHALL list Sales, Review, Enter claims, ProRewards, Saved matches and Settings, show the logo and the
app version, and mark the current screen. Review and Enter claims SHALL be disabled, with the reason shown,
until the step before them is done.

#### Scenario: First start
- **WHEN** the person starts the app for the first time
- **THEN** the window opens at 1280 × 800 on the Sales screen, with Review and Enter claims disabled

#### Scenario: Window size remembered
- **WHEN** the person resizes the window and restarts the app
- **THEN** the window opens at the size it had, never smaller than 1100 × 700

#### Scenario: Disabled step explains itself
- **WHEN** the person points at the disabled Review item
- **THEN** a tooltip says to load the month's sales first

### Requirement: Themes
The app SHALL offer Light, Dark and "Same as Windows" themes, default "Same as Windows", built only from the
color tokens in `docs/ui.md`. The choice SHALL be remembered. Text SHALL meet a 4.5:1 contrast ratio in both
themes.

#### Scenario: Follows Windows
- **WHEN** the theme is "Same as Windows" and Windows switches to dark mode
- **THEN** the app switches to the dark theme without a restart

#### Scenario: Chosen theme kept
- **WHEN** the person picks Dark and restarts the app
- **THEN** the app opens in the dark theme

### Requirement: Screens cannot reach the system
The screens SHALL run sandboxed, with context isolation and no Node access, and load only the app's own
bundled files under a strict Content-Security-Policy. They SHALL reach the main process only through a fixed,
named set of calls, and the main process SHALL validate every call's input and reject anything else.

#### Scenario: Unknown call
- **WHEN** a screen sends a message that is not one of the named calls, or a named call with invalid input
- **THEN** the main process rejects it, does nothing else, and logs it

#### Scenario: No Node in screens
- **WHEN** code in a screen tries to use `require` or `process`
- **THEN** they are not available

### Requirement: Saved settings
Settings SHALL be stored in the user's app data folder, written atomically, and checked when read. A missing
or damaged settings file SHALL fall back to defaults without an error.

#### Scenario: Damaged settings file
- **WHEN** the settings file is not valid
- **THEN** the app starts with default settings and logs that it did

### Requirement: Logging
The app SHALL keep a log in a `logs` folder in its app data folder, keeping the last 5 files of at most
5 MB each. Unexpected errors SHALL be logged with details and shown to the person as a short, plain message.

#### Scenario: Unexpected error
- **WHEN** an unexpected error happens in the main process
- **THEN** the person sees "Something went wrong. Details were saved to the log." and the log has the error

### Requirement: One copy at a time
Only one copy of the app SHALL run at a time.

#### Scenario: Started twice
- **WHEN** the person starts the app while it is already open
- **THEN** no second window opens, and the open window comes to the front
