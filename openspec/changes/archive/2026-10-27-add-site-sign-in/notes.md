# Sign-in and navigation verification notes

## Pause checkpoint — October 27, 2026

At this pause checkpoint, milestone 06 (`add-site-sign-in`) had 6 of 7 tasks checked in `tasks.md`. The live check has since been confirmed by the user and recorded below.

The latest complete `npm.cmd run check` passed: lint, formatting, typecheck, build, 140 Vitest tests across 31 files, and 50 Electron end-to-end tests. `npx.cmd openspec validate add-site-sign-in --strict` and `git diff --check` also passed. No commit was made; milestone 05 and 06 edits remain uncommitted in the working tree. Milestone 05 has its own outstanding confirmation in `openspec/changes/add-claim-entry/tasks.md` and should not be treated as complete.

For closeout, read this file and `tasks.md`, rerun strict OpenSpec validation, and use the completed full check recorded here as verification of the unchanged application code. Archive milestone 06 when its spec sync is resolved. Keep real credentials, dealer IDs, invoices and sales data out of this file.

## Automated checks

- Credential tests cover encrypted storage, refusal when Windows encryption is unavailable, and forgetting the password. The Settings card was exercised in Electron.
- Saved private login, home, program-choice and claim pages were used to verify page detection. These tests skip when `private-data/` is absent.
- The saved login page tests cover a successful single postback and a page that remains on login for 20 seconds without a second attempt.
- A restart test confirms persistent site cookies survive when Stay signed in is on and are cleared when it is off.
- The saved program-choice page tests cover one match, no match and two matches. Match tires end-to-end tests cover the program Next link, handoff when no match or two matches exist, a 15-second claim-page timeout, and automatic continuation after the person opens the claim page.
- Starting Match tires before the site tab has opened exposed a hidden-tab startup issue; the app now opens the tab before reading it. The Sales screen test covers that path.
- Sign out and forget password clears the saved password and site cookies, then shows the login page in a private saved-page test.

## Supervised live check

The user subsequently confirmed that both milestone 06 live tests worked. Task 4.1 is checked on the basis of that report. No timings or sensitive details were recorded. Strict OpenSpec validation and `git diff --check` passed after the initial test report.

A later `npm.cmd run check` was stopped at the user's request while its Electron tests were running. That interrupted run does not count as a completed check. The earlier complete check recorded above passed before this note and task update; no application code changed between the complete run and the live-test confirmation.

For closeout, a fresh `npm.cmd run check` completed successfully: lint, formatting, typecheck, 140 unit tests, build, and all 50 Electron end-to-end tests. `npx.cmd openspec validate add-site-sign-in --strict` passed. The delta was synced to `openspec/specs/site-sign-in/spec.md`, and `openspec validate --specs` passed all six main specs.

The two reported live scenarios were: (1) from signed out, Match tires used the saved password and reached the claim page without manual website clicks; (2) a wrong saved password produced one attempt, then the 20-second message and handoff to the ProRewards tab. This records the user's pass report rather than an independently observed run.
