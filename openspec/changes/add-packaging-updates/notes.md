# Packaging and update verification notes

## Installer

- `npm.cmd run make:icons` generated PNGs and an ICO with 16, 32, 48, and 256 pixel images; the icon test passed.
- `npm.cmd run dist:win` built `release/Auto-Spiffer-Setup-1.0.0.exe` locally. The artifact used the planned name, separate from the 0.x updater's expected name.
- A silent local install returned exit code 0, created `%LOCALAPPDATA%\Programs\AutoSpiffer\AutoSpiffer.exe`, and left all 664 files in the existing `%LOCALAPPDATA%\Programs\Auto Spiffer` folder unchanged by name, size, and write time.
- The installed executable started and created a renderer process with its own temporary user data directory. Its embedded icon was extractable, and the Start Menu and desktop shortcuts pointed to the new executable.
- A silent uninstall returned exit code 0 and removed the new executable. `%APPDATA%\Auto Spiffer` remained, and the old 0.x folder remained unchanged. The test installation was removed after verification.
- The test shell was elevated, so an install under a standard user token has not been observed. Task 1.2 remains open for that check.

The packaged app could not be attached through Playwright's Electron launcher; it timed out before returning a window. A direct process launch stayed running and created a renderer process, so the Playwright attachment test was removed. No packaged-app startup claim depends on that harness.

## Release candidate preparation

- The working tree is set to version `1.0.0-rc1` in `package.json` and `package-lock.json`. No tag or release has been published.
- A local RC1 build produced `release/Auto-Spiffer-Setup-1.0.0-rc1.exe`, its blockmap, and `release/prerelease.yml`. The feed names version `1.0.0-rc1` and the installer; the packaged `app-update.yml` selects the GitHub `prerelease` channel.
- One overlapping packaging attempt failed with `EBUSY` while the first job was still compressing `release/win-unpacked`. The original job completed and produced the artifacts above.
- Under RC1, lint, formatting, typecheck, 156 unit tests, 50 Electron tests, and strict OpenSpec validation passed. The RC1 app build also passed.
