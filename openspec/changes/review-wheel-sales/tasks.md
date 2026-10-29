# Tasks

## 1. Recognize wheel sales

- [x] 1.1 Add synthetic classification tests for explicit wheel wording, wheel size plus bolt pattern (including both observed formats), and tire, tube, shipping, and ambiguous counterexamples; verify the focused sales-rules tests fail for the new wheel cases first.
- [x] 1.2 Extend the transient sale classification and shared validation schema with a wheel category, keeping shipping and tubes ahead of wheel detection; verify the sales-rules and sales-reader tests pass.
- [x] 1.3 Document the wheel detection rule in `docs/matching.md` with invented descriptions only; verify it agrees with the classification tests.

## 2. Show wheels on Review

- [x] 2.1 Add a distinct Possible wheel review status and exclude it from tire matching, ready counts, saved tire choices, and automatic entry; verify focused matching, review-session, and run tests cover one tire plus one wheel.
- [x] 2.2 Add the Wheels filter, count, row label, manual guidance, and non-tire row interaction on Review; verify focused Review screen tests cover Wheels, All, Not a tire, search, and the Enter count.
- [x] 2.3 Document the Wheels view and its exact manual guidance in `docs/ui.md`; verify the copy matches the Review screen test.

## 3. Integration

- [x] 3.1 Run `openspec validate review-wheel-sales --strict`, typecheck, lint, and the focused unit and Electron review tests; verify all pass without using private sales data in committed fixtures.

## Workflow follow-up

- After the user checks the new Review view, archive the change so its delta specs move into the main specs.
