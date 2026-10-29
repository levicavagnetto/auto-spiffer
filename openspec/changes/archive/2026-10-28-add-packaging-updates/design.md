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
Use a distinct shortcut named for the major and minor version, such as `Auto Spiffer 1.0` or
`Auto Spiffer 1.1`, computed from `package.json` by the builder config. The installer launches its
executable directly and repairs the new shortcut target; when 0.4.0 is installed, retain its
`Auto Spiffer` shortcut.

### D2. Icons
`scripts/make-icons.mjs` renders `docs/brand/logo.svg` to PNGs (16 to 256 px) and `build/icon.ico`; the outputs
are committed so the build needs no extra tools.

### D3. Updater
`electron-updater` `autoUpdater` with `autoDownload: true`, `autoInstallOnAppQuit: true`, `allowPrerelease: false`.
`quitAndInstall` is only called when the runner reports no run going; otherwise it is queued for the run's end.
Before quitting for an update, close the ProRewards view. Events go to the sidebar and Settings over IPC.
Keep the project's `rcN` naming (`1.0.0-rc4`). GitHub's provider treats `rc4` and `rc5` as different channels,
so the live update check uses the production path: install RC4, publish stable 1.0.0, and confirm RC4 downloads
and installs 1.0.0 from `latest.yml`. Installed builds select `latest` and do not install prereleases. RC release
feeds remain available for downloads and manual install checks.

### D4. Release workflow
`windows-latest`, Node 24: check the tag against `package.json`, `npm ci`, `npm run check` (private tests skip
themselves), `electron-builder --publish always` with `GH_TOKEN`. Prerelease when the tag has a suffix.
Create the GitHub Release as a draft before publishing assets, then make it public after the upload succeeds.
For tags with a suffix, explicitly publish to the `prerelease` channel. GitHub does not infer this channel.

## Risks / Trade-offs

- Unsigned builds show a SmartScreen warning on first install; README explains "More info, Run anyway".
- Two "Auto Spiffer" entries exist in Windows Settings until the person removes the 0.x one; the README says so.
