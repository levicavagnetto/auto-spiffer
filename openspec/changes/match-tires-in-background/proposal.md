# Proposal

## Why

Match tires currently switches from Sales to ProRewards before automatic sign-in and navigation. This interrupts the person's workflow even when saved credentials or cookies let the app finish on its own.

## What Changes

- Load and drive the ProRewards web contents while the Sales screen stays visible.
- Open Review only after the claim page is ready and matching succeeds.
- Show a temporary error toast on Sales if matching fails; a sign-in failure says "Could not log in" and directs the person to ProRewards.
- Keep interactive sign-in and claim-entry recovery available when the person opens ProRewards or enters claims.

## Capabilities

### Modified Capabilities

- `site-sign-in`: Background Match tires sign-in and nonblocking failure handling.
- `tire-matching`: Match tires opens Review only on success.

## Impact

Site view initialization, Match tires IPC and renderer flow, navigation failure handling, and focused tests.
