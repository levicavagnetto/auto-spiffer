# 10 · Protractor login

## Why

Auto Spiffer is about to fetch missing invoices from Protractor so the person no longer exports each invoice PDF by
hand (changes 11 to 13). Protractor needs its own username and password, separate from ProRewards. The app needs a
safe place to keep them and a plain way to show whether they work.

## What Changes

- A **Protractor login** card in Settings, above the ProRewards sign-in card: username, password, **Save** and
  **Forget login**.
- The password is encrypted with the Windows account like the ProRewards password, never logged, and never sent
  back to the screen.
- The login is optional. Without one, the app works as today and missing PDFs stay on the missing list.
- The card shows the result of the last Protractor sign-in this session (signed in, wrong username or password,
  could not reach Protractor) once change 11 uses it.

## Capabilities

### New Capabilities

- `protractor-sign-in`: storing the Protractor login and showing its state.

### Modified Capabilities

None. The ProRewards sign-in (`site-sign-in`) is unchanged.

## Impact

- A second encrypted credentials file next to the ProRewards one, IPC to read, save and forget it, and the Settings
  card.
- `docs/architecture.md` (Storage table) and `docs/ui.md` (Settings card order).
- First of four changes, built in order: 10 Protractor login, 11 Fetch invoices from Protractor, 12 Make invoice
  PDFs, 13 Clean up made PDFs. Build after the open UI changes are archived.
