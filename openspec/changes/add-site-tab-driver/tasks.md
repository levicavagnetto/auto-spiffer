# Tasks

## 1. The tab

- [ ] 1.1 Create the ProRewards `WebContentsView` with its own persistent session, bounds following a placeholder in the ProRewards screen, hidden on other screens (design D1); verify an e2e test that it shows on the ProRewards screen and hides on Sales
- [ ] 1.2 The slim bar (Reload, address, status chip) and off-site links and new windows sent to the normal browser; verify unit tests for the link rule and an e2e test that an external link does not navigate the tab
- [ ] 1.3 The CI-safe trimmed claim page fixture (design D4) and the network-blocked test mode for the tab; verify a test that a request to `https://` from the fixture is cancelled

## 2. Reading

- [ ] 2.1 `isClaimPage` and `readPage` (promotion, program dates, tire list, sale list) with the selectors in one module; verify private tests against the saved page for the 77 labels, the promotion and the dates, and committed tests against the trimmed fixture

## 3. Doing

- [ ] 3.1 `guardedClick` with the never-click list and the Next/Submit text rule; verify unit tests that each listed selector and a Next-labeled element are refused, and an e2e test with the stub that Next is never clicked
- [ ] 3.2 Port the legacy stub (`origin/legacy:auto_spiffer/page_stub.py`) to a test-only script for Add, popups and uploads; verify it with a test that a stubbed Add appends a row
- [ ] 3.3 `addLine` with direct filling, read-back, the typing fallback, Add and the five outcomes (design D3, `docs/site-reference.md`); verify private e2e tests for added, duplicate (No clicked), rejected (text read, dismissed), mismatch, a tire not in the list, and an added line while the window is minimized
- [ ] 3.4 `upload` through the in-process debugger; verify a private e2e test that the stub sees the file, and that no TCP port is opened (check `app.commandLine` has no remote debugging switch)
- [ ] 3.5 `screenshot`; verify a test that a PNG lands in the logs folder

## 4. Live proof (with the user)

- [ ] 4.1 With the user signed in on the live claim page for a current program: add one real line through the driver, upload one real invoice PDF, confirm both on the site, then the user deletes the line and the file on the site. Record the timings and the result in this change's `notes.md`. If filling or uploading fails, stop and ask the user about Plan B (design D5)

## Workflow follow-up

- Run `openspec validate add-site-tab-driver --strict` and `npm run check`, then archive.
