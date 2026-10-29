# 07 · Installer, updates and release

## Why

The app has to reach the shop's computers as a normal Windows install and keep itself up to date without anyone
downloading files by hand, and releases have to be one tag push. People on the old 0.x app also need a clear way
across.

## What Changes

- An NSIS installer (per user, no admin) built by electron-builder, with the app icon made from the logo.
- Automatic updates from this repo's GitHub Releases with electron-updater: check at startup and every 6 hours,
  download in the background, install only when no claim is being entered.
- The Updates and Logs cards in Settings, and the sidebar's version line.
- A GitHub Actions release workflow on `v*` tags: check the version, run the checks, build, publish.
- The move from 0.x: the old app's updater must not pick up the 1.0 installer; the README tells 0.x users how
  to switch.

## Capabilities

### New Capabilities
- `app-updates`: installing, updating, releasing, and the move from 0.x.

### Modified Capabilities
- None.

## Impact

- `electron-builder.config.cjs`, `build/` (icons), `.github/workflows/release.yml`, `src/main/updates.ts`, Settings
  cards, `README.md`.
- Depends on `add-app-shell` and `add-claim-entry` (the "no run going" check).
