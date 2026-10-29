# Tasks

## 1. Shared claim-page recovery

- [x] 1.1 Update the navigator to verify the requested month even when already on a claim page, and navigate from Home, other pages, program choice, or a wrong-month claim using only permitted controls. Verify unit cases for each starting page, unique and ambiguous programs, and claim-page never-click rules.
- [x] 1.2 Make navigation/sign-in handoff bounded and cancellable with one saved-password attempt and plain-language attention results. Verify timeout, manual sign-in, cancellation, and failed sign-in cases in navigator tests.

## 2. Start and recheck

- [x] 2.1 Route Match tires, Start entering, and Check page and run again through the shared recovery path before reading the claim page. Verify unit cases for leaving the tab before each action and for a different-month claim.
- [x] 2.2 Keep the run out of `running` when recovery or page validation fails, with actionable screen text and no writes. Verify RunSession tests for failed navigation, wrong dates/products, and recovery followed by successful checking.

## 3. Recovery during entry

- [x] 3.1 Recover and revalidate before each line, then repeat the live sale-list duplicate check; stop the whole run on page-wide failure. Verify runner tests for moving to Home between lines, existing lines, and unrecoverable navigation.
- [x] 3.2 Track added sales only in memory for the active run, verify they remain on the recovered page, and verify the current invoice's sale before uploading its PDF once. Verify runner tests for a missing earlier sale, navigation before upload, and no duplicate upload.
- [x] 3.3 Preserve Pause/Stop, close-after-line, and final manual submission behavior through recovery. Verify focused run-control and never-click tests.

## 4. End-to-end integration

- [x] 4.1 Add or adapt a synthetic saved-site fixture with invented sales so an Electron test can leave the claim page before Start and before Check page and run again, then verify return to the intended month and no duplicate entry. Verify the focused Electron test passes without `private-data/`.
- [x] 4.2 Run `npx.cmd openspec validate recover-claim-page-before-actions --strict`, the focused unit and Electron tests, and typecheck; verify all pass and no real sales or invoice data entered git.

## Workflow follow-up

- Archive the change after implementation and verification are complete.
