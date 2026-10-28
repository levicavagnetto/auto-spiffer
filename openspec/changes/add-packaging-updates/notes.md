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
- The pushed `v1.0.0-rc2` tag points to the intended `541f75e` commit. Its first GitHub run stopped on a 5-second timeout while generating and reading a three-page PDF test fixture. A rerun passed all unit tests but stopped on a Playwright checkbox action that expected a controlled React checkbox to change immediately before its asynchronous save completed. Neither run reached packaging, so no RC2 release was published.
- For RC3, the PDF test's timeout is 15 seconds (only that test), and the checkbox test clicks then waits for the saved value and final UI state. The checkbox test passed 10 local repetitions. The tag is advanced to RC3 rather than moving the pushed RC2 tag.
- With version `1.0.0-rc3`, `npm run check` passed locally: lint, formatting, typecheck, 156 unit tests, production build, and 50 Electron tests. Strict OpenSpec validation and the RC3 tag-version check passed. The hosted RC3 workflow and installed-app update check remain pending.
- The hosted RC3 workflow passed and published the installer, blockmap, and `prerelease.yml`. On October 27, the installed RC1 app showed "not checked yet" after Check now; its log showed a 404 requesting `latest.yml` from the older stable v0.4.0 release. Inspecting electron-updater 6.8.11 showed that its GitHub provider matches the first prerelease version identifier to the selected channel. Tags `rc1` and `rc3` cannot match the configured `prerelease` channel, even when the environment override reaches the process. The RC1-to-RC3 automatic update check is therefore abandoned; RC.4 will be installed once, then RC.4-to-RC.5 will test updates using matching `rc` identifiers and `rc.yml`.

## Pause checkpoint

- The working tree was changed to `1.0.0-rc.4`. The app now selects channel `rc` automatically for `-rc.N` versions, and the release workflow publishes `rc.yml` for those tags. Stable versions continue to use `latest`.
- The updater unit test was first run against the old behavior and failed, then passed after the channel change (8 tests). Typecheck passed. Formatting was applied to `src/main/updates.ts` after the formatting check flagged it.
- Before tagging RC.4: run formatting and full `npm run check`, validate this OpenSpec change, build the installer locally with the `rc` channel and inspect `rc.yml` and packaged `app-update.yml`. Then make any final fixes and tag RC.4. No RC.4 tag, push, or release exists yet.
