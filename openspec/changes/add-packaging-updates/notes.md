# Packaging and update verification notes

## Installer

- `npm.cmd run make:icons` generated PNGs and an ICO with 16, 32, 48, and 256 pixel images; the icon test passed.
- `npm.cmd run dist:win` built `release/Auto-Spiffer-Setup-1.0.0.exe` locally. The artifact used the planned name, separate from the 0.x updater's expected name.
- A silent local install returned exit code 0, created `%LOCALAPPDATA%\Programs\AutoSpiffer\AutoSpiffer.exe`, and left all 664 files in the existing `%LOCALAPPDATA%\Programs\Auto Spiffer` folder unchanged by name, size, and write time.
- The installed executable started and created a renderer process with its own temporary user data directory. Its embedded icon was extractable, and the Start Menu and desktop shortcuts pointed to the new executable.
- A silent uninstall returned exit code 0 and removed the new executable. `%APPDATA%\Auto Spiffer` remained, and the old 0.x folder remained unchanged. The test installation was removed after verification.
- On October 27, the user installed the published RC1 normally and reported no administrator prompt; the existing 0.4.0 app still worked. Together with the local start, icon, and uninstall checks above, this completes task 1.2.

The packaged app could not be attached through Playwright's Electron launcher; it timed out before returning a window. A direct process launch stayed running and created a renderer process, so the Playwright attachment test was removed. No packaged-app startup claim depends on that harness.

## Release candidate preparation

- The `v1.0.0-rc1` GitHub release workflow passed every step and published the RC1 installer, blockmap, and `prerelease.yml` as a prerelease. The user reported that the installed RC1 works. The working tree is now being prepared for `1.0.0-rc2`.
- A local RC1 build produced `release/Auto-Spiffer-Setup-1.0.0-rc1.exe`, its blockmap, and `release/prerelease.yml`. The feed names version `1.0.0-rc1` and the installer; the packaged `app-update.yml` selects the GitHub `prerelease` channel.
- One overlapping packaging attempt failed with `EBUSY` while the first job was still compressing `release/win-unpacked`. The original job completed and produced the artifacts above.
- Under RC1, lint, formatting, typecheck, 156 unit tests, 50 Electron tests, and strict OpenSpec validation passed. The RC1 app build also passed.
- For RC2, `package.json` and `package-lock.json` were changed to `1.0.0-rc2`. `npm run check` passed (lint, formatting, typecheck, 156 unit tests, production build, and 50 Electron tests). Strict OpenSpec validation and the `v1.0.0-rc2` tag-version check passed. The RC2 update has not yet been tested on the installed RC1 app.
