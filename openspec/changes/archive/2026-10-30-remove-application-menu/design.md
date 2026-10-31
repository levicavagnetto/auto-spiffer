# Design

## Decision

Call `Menu.setApplicationMenu(null)` after Electron is ready and before creating the main window. This removes the menu itself, including the Windows Alt-key menu behavior. The native title bar and controls remain.

## Verification

Launch the Electron app in the smoke test and assert `Menu.getApplicationMenu()` is null while the window opens normally.
