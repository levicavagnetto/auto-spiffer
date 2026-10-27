# Tasks

## 1. Runner

- [x] 1.1 `checkPage` (claim page, program, dates, tires) with plain messages; verify unit tests for each failure and for passing
- [x] 1.2 The runner (design D1) against a fake driver: grouping and order, skip when on the page, fail on a different quantity, retry once, no retry on duplicate, screenshot on failure, upload rules; verify a unit test for every scenario in the spec
- [x] 1.3 Run control (pause, resume, stop between lines, stop still uploads a partly added invoice) and the one-run rule; verify unit tests with a fake driver that is slow on one line

## 2. Screen and app integration

- [x] 2.1 IPC: start, pause, resume, stop, and the run events; the Enter claims screen in its three states (plan, running, summary) per `docs/ui.md`, with the tab on the right; Review shows run results; verify component tests for each state
- [x] 2.2 The close guard (design D3); verify an e2e test that closing during a run asks, and closes only after the current line
- [x] 2.3 End-to-end with generated sales and PDFs against the committed trimmed claim page, plus a private saved-page smoke test that skips when private data is missing: a full ready-line run, a stop and restart that skips the first line, a duplicate, a rejected line, and proof from the stub's click log that Next was never clicked; verify they pass
- [x] 2.4 Keep a long completed-run summary inside the Enter pane: show missing PDFs as a counted compact group, scroll all detail rows, and keep counts, rerun and submission reminder visible; verify a component test with many missing PDFs and an Electron test at the minimum window size
- [x] 2.5 Keep the sidebar visible while Review scrolls, allow its own contents to scroll if needed, and start newly selected screens at the top; verify an Electron test using a long Review list at the minimum window size

## 3. Live run (with the user)

- [ ] 3.1 With the user, on a real month that has not been submitted: run with the first 2 lines only (a temporary developer setting, not in the shipped UI), check them on the site, then run the rest; the user submits. Record the timings and any surprises in `notes.md`

## Workflow follow-up

- Run `openspec validate add-claim-entry --strict` and `npm run check`, then archive.
