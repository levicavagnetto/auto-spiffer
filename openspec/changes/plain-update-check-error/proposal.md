# Proposal

## Why

In a development build, Check now currently shows Electron's IPC error wrapper inside the Updates card. The person needs a short, plain explanation.

## What Changes

- Show a temporary error toast with exactly "Install Auto Spiffer to check for updates" when Check now runs in a development build.
- Use the same toast style as other app errors; keep the Updates card compact.

## Capabilities

### Modified Capabilities

- `app-updates`: Check now error presentation in Settings.

## Impact

Settings renderer, shared error toast, and focused tests. Update checking behavior is unchanged.
