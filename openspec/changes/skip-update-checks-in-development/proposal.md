# Proposal

## Why

Check now is blocked in development builds, but turning on Install updates automatically still reaches the update controller's check path. Development builds should not contact the update feed from either control.

## What Changes

- Keep saving the automatic-update preference in development builds.
- Skip startup, scheduled, and preference-triggered update checks when the app is not packaged.
- Keep installed-build update behavior unchanged.

## Capabilities

### Modified Capabilities

- `app-updates`: Development-build update behavior.

## Impact

Update controller guard, main-process configuration, and focused tests.
