# Tasks

## 1. Installer

- [x] 1.1 Icons from the logo (design D2); verify `build/icon.ico` contains 16, 32, 48 and 256 px images
- [x] 1.2 electron-builder config (design D1) with the separate install folder and the artifact name; verify a local build installs without admin, starts, shows the icon, and leaves `%LOCALAPPDATA%\Programs\Auto Spiffer` untouched; uninstall keeps the app data folder

## 2. Updates

- [x] 2.1 The updater (design D3) with the startup and 6-hour checks, the no-run rule and the queued install; verify unit tests with a mocked autoUpdater for each spec scenario
- [x] 2.2 Settings Updates and Logs cards and the sidebar version line and "ready" state; verify component tests

## 3. Release and move from 0.x

- [x] 3.1 The release workflow (design D4); verify locally that a mismatched tag fails early. Verify the hosted workflow on the rc tags in task 3.3
- [x] 3.2 README for 1.0 (install, the SmartScreen warning, every month step by step, moving from 0.x, where data lives, for developers)
- [ ] 3.3 With the user: publish `v1.0.0-rc4` as a prerelease, install it, then publish stable `v1.0.0` and confirm RC4 downloads and installs 1.0.0 through the `latest` channel. Record the result in `notes.md`. RC2 was tagged but not published because its release checks failed.
- [ ] 3.4 After publishing 1.0.0, verify with the user that a 0.4.0 install's Update button opens the 1.0 release page and does not run the 1.0 installer

## Workflow follow-up

- Run `openspec validate add-packaging-updates --strict` and `npm run check` before each release. After the RC4 install check, publish `v1.0.0`, verify 3.3 and 3.4, then archive.
