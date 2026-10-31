# Proposal

## Why

The Enter claims screen uses the browser's native progress element, whose Windows styling does not match Auto Spiffer's colors or controls.

## What Changes

- Replace the native bar with shadcn/ui's Base UI Progress component.
- Use the app's primary color for the indicator and muted color for the track in both themes.
- Preserve the existing completed and total sale counts and make the progress accessible by name.

## Capabilities

### Modified Capabilities

- `claim-entry`: Entering progress uses the app theme and announces completed sales accurately.

## Impact

Enter claims renderer, reusable UI component, Base UI dependency, and focused UI test. Claim entry logic is unchanged.
