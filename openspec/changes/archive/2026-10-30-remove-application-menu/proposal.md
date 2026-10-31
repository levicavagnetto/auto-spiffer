# Proposal

## Why

Electron's default File, Edit, View, and Window menu occupies a strip above the app. The app's own navigation and controls cover the needed actions.

## What Changes

- Remove the default application menu from the Auto Spiffer window.
- Keep the native title bar and window controls.

## Capabilities

### Modified Capabilities

- `app-shell`: The main window opens without an application menu.

## Impact

Electron main-process window setup, UI documentation, and a focused Electron smoke test.
