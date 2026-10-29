# Tasks

## 1. Sales header action

- [x] 1.1 Add a shared page-header action target and move Match tires into it for both empty and loaded Sales states; verify the existing match flow still opens Review, the button is disabled before import and while busy, and only one Match tires button exists.
- [x] 1.2 Update the Sales section of `docs/ui.md` and add a component or Electron layout check that the button sits in the header at the 1100 × 700 minimum window size.

## 2. Review header action

- [x] 2.1 Move Enter N sales and its decision warning into the shared header, preserving ready counts, disabled rules and the Enter claims navigation; verify component tests for undecided, zero-ready and ready states.
- [x] 2.2 Update the Review section of `docs/ui.md` and verify in an Electron test at 1100 × 700 that the header action remains reachable after scrolling a long Review list, with no duplicate button in the page body.

## Workflow follow-up

- Run `openspec validate move-primary-actions-to-page-headers --strict` and `npm run check`, then archive the change after the user's visual check.
