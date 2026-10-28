# Design

## Context

The 0.x app used PyInstaller, Inno Setup and its own updater (`git show origin/legacy:auto_spiffer/updates.py`,
`origin/legacy:installer/auto_spiffer.iss`, `origin/legacy:.github/workflows/release.yml`). 0.x installs into
`%LOCALAPPDATA%\Programs\Auto Spiffer` and keeps its `data\` folder there. Its updater looks for a release asset
named `AutoSpiffer-Setup-<tag>.exe` with an https URL, size and SHA-256 digest, and runs it with Inno Setup flags.

## Goals / Non-Goals

**Goals:** a standard installer and updater; one-tag releases; a safe, explained move from 0.x.

**Non-Goals:** code signing (later, optional: Azure Trusted Signing); macOS or Linux; importing 0.x data.

## Decisions

### D1. electron-builder
`appId: com.backburnerlabs.autospiffer` (new, never change it), `productName: Auto Spiffer`, target `nsis` with
`oneClick: true`, `perMachine: false`, `deleteAppDataOnUninstall: false`, and an install folder that is **not**
`%LOCALAPPDATA%\Programs\Auto Spiffer` (where 0.x lives): set the NSIS install directory through a `preInit`
macro in `build/installer.nsh` to `%LOCALAPPDATA%\Programs\AutoSpiffer`. Artifact name
`Auto-Spiffer-Setup-${version}.exe` (does not match the 0.x updater's `AutoSpiffer-Setup-<tag>.exe`). `publish:
github` (owner `levicavagnetto`, repo `auto-spiffer`).

### D2. Icons
`scripts/make-icons.mjs` renders `docs/brand/logo.svg` to PNGs (16 to 256 px) and `build/icon.ico`; the outputs
are committed so the build needs no extra tools.

### D3. Updater
`electron-updater` `autoUpdater` with `autoDownload: true`, `autoInstallOnAppQuit: true`, `allowPrerelease: false`.
`quitAndInstall` is only called when the runner reports no run going; otherwise it is queued for the run's end.
Before quitting for an update, close the ProRewards view. Events go to the sidebar and Settings over IPC.
RC builds use versions like `1.0.0-rc.4`: `rc` is the prerelease identifier and the GitHub update-feed channel.
The release workflow publishes `rc.yml` for those tags. An installed RC build selects `rc` and permits
prereleases automatically; `AUTO_SPIFFER_UPDATE_CHANNEL=rc` also lets a developer opt a stable build into that
channel for testing. Stable builds use `latest` and do not permit prereleases. The first shipped RC used a
`prerelease` channel with tags such as `rc1`, which the GitHub provider cannot match; it requires a one-time
installer upgrade before the RC-to-RC update check.

### D4. Release workflow
`windows-latest`, Node 24: check the tag against `package.json`, `npm ci`, `npm run check` (private tests skip
themselves), `electron-builder --publish always` with `GH_TOKEN`. Prerelease when the tag has a suffix.
Create the GitHub Release as a draft before publishing assets, then make it public after the upload succeeds.
For tags whose version contains `-rc.`, explicitly publish to channel `rc`; GitHub does not infer this channel.

## Risks / Trade-offs

- Unsigned builds show a SmartScreen warning on first install; README explains "More info, Run anyway".
- Two "Auto Spiffer" entries exist in Windows Settings until the person removes the 0.x one; the README says so.
