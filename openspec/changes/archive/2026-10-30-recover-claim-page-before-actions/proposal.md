# Proposal

## Why

Match tires already navigates to the month's claim page, but Start entering and Check page and run again assume the person has left the tab there. Visiting another ProRewards page before either action makes claim entry stop even when the app is still signed in.

## What Changes

- Reuse claim-page navigation whenever matching, page checking, entry, or invoice upload needs that page and it is no longer open.
- Recover the selected month from Home, another ProRewards page, the program-choice step, or a different month's claim page; then recheck the program, dates, tires, and live sale list before entering or uploading.
- Keep sign-in attempts limited to the existing saved-password behavior. When sign-in or safe navigation cannot finish, explain what the person needs to do in the tab and enter nothing further.
- Preserve the never-submit and duplicate protections during recovery and reruns.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `site-sign-in`: The month's claim-page navigation is available to every claim-page-dependent action, not only Match tires.
- `tire-matching`: Match tires waits for the correct claim page and uses its live Eligible Product list.
- `claim-entry`: Start, page check, rerun, per-line entry, and PDF upload recover and validate the claim page before acting.

## Impact

Main-process navigation and run orchestration, plain-language attention messages, unit tests for recovery and guards, and focused Electron tests with invented sales. No new saved month or entry history, runtime browser, or submission action.
