# Tasks

## 1. Simplify Sales

- [x] 1.1 Remove the ProRewards and Ready to match cards and card-only props from Sales and App; verify the export, PDF controls, warning text, header Match tires action, and sidebar ProRewards navigation still work in the existing Sales flow tests.
- [x] 1.2 Make the export and PDF cards fill a single content column, update `docs/ui.md`, and verify an Electron layout check at 1100 × 700 that both cards use the available width, warnings wrap, and no removed card headings remain.

## Workflow follow-up

- Run `openspec validate simplify-sales-page --strict`, lint, formatting, typecheck, and focused Sales and navigation Electron tests. The user prefers focused checks for UI cleanups; reserve the full suite for broader changes or a release. Archive after the user's visual check.
