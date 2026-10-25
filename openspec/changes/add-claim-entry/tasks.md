# Tasks

## 1. Runner

- [ ] 1.1 `checkPage` (claim page, program, dates, tires) with plain messages; verify unit tests for each failure and for passing
- [ ] 1.2 The runner (design D1) against a fake driver: grouping and order, skip when on the page, fail on a different quantity, retry once, no retry on duplicate, screenshot on failure, upload rules; verify a unit test for every scenario in the spec
- [ ] 1.3 Run control (pause, resume, stop between lines, stop still uploads a partly added invoice) and the one-run rule; verify unit tests with a fake driver that is slow on one line

## 2. Screen and app integration

- [ ] 2.1 IPC: start, pause, resume, stop, and the run events; the Enter claims screen in its three states (plan, running, summary) per `docs/ui.md`, with the tab on the right; Review shows run results; verify component tests for each state
- [ ] 2.2 The close guard (design D3); verify an e2e test that closing during a run asks, and closes only after the current line
- [ ] 2.3 End-to-end against the saved claim page with the stub (private): a full run of the sample month's ready lines, a stop and restart that skips the first lines, a duplicate, a rejected line, and proof from the stub's click log that Next was never clicked; verify they pass

## 3. Live run (with the user)

- [ ] 3.1 With the user, on a real month that has not been submitted: run with the first 2 lines only (a temporary developer setting, not in the shipped UI), check them on the site, then run the rest; the user submits. Record the timings and any surprises in `notes.md`

## Workflow follow-up

- Run `openspec validate add-claim-entry --strict` and `npm run check`, then archive.
