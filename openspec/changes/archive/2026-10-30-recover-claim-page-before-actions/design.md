# Design

## Context

See [proposal.md](proposal.md). Match tires calls the claim navigator before reading the product list. `RunSession.check()` and `RunSession.start()` instead read the current tab immediately, and the runner does the same before lines and PDF uploads. The navigator can find the program from other site pages and sign in, but currently treats any claim page as ready without checking its month. The page checker and live sale-list duplicate guard are separate protections that recovery must preserve. Site controls and the never-click list are in `docs/site-reference.md`.

## Goals / Non-Goals

**Goals:** Make one main-process navigation path available at each claim-page-dependent action; verify the intended month and claim state before any mutation; make navigation failures finite and actionable; preserve run controls, duplicate protection, and the site's manual final submission.

**Non-Goals:** Persisting entered months or sales, changing matching rules, bypassing sign-in, auto-submitting a claim, or introducing another browser automation runtime.

## Decisions

### Use the existing navigator as the single entry point

Give the existing claim navigator an `ensure` operation for a requested month. It inspects the live tab, including the promotion when already on a claim page. A matching claim page can be reused; a wrong-month claim page must be left by opening the Submit Sale route, not by clicking the claim form's Back or Next. From Home, another site page, or program choice, reuse the current sign-in, unique-month selection, and guarded program-choice Next. Keep navigation in the main process at the orchestration boundary rather than hiding it in low-level read or fill methods, so every recovered page is explicitly checked before a write.

Alternative considered: require the person to navigate back manually. This leaves the reported failure in place. Automatically navigating on every driver call would obscure which page was verified for a particular action.

### Recover before starting or rechecking, with a bounded attention state

`RunSession.check()` and `.start()` ensure the requested page before `readPage()` and `checkPage()`. The existing Match tires path uses the same month verification. If a handoff is needed for login or program selection, show what to do in the site tab and resume only after a verifiable page appears. Navigation has a finite timeout or explicit cancellation/attention outcome; the run must not remain indefinitely in `checking`. Failure returns to an idle or attention state with a plain-language message and no site writes. Reuse the existing one-attempt saved-password policy; never loop password attempts.

Alternative considered: retry the whole Start action after any read failure. A read failure may mean the wrong month or changed site markup, so retries alone do not establish a safe target.

### Treat a moved page during entry as a run-wide safety event

Before each sale and before each PDF upload, ensure the intended page and rerun the relevant program/date/product checks. Keep an in-memory set of sales successfully added in this run. After recovery, confirm those sales still appear in the live Cumulative Sale(s) List before continuing. For the next sale, use the live duplicate check again; for an invoice upload, confirm its sale is visible and upload at most once. A missing earlier sale, wrong program, ambiguous program choice, unavailable login, or unverifiable page stops remaining automatic work and asks the person to review the tab. Page-wide navigation failures must not be caught as ordinary line failures that allow later lines to proceed. Preserve Pause/Stop and close-after-line behavior during recovery.

Alternative considered: continue with the next line after each navigation error. That could enter data into another claim or another draft and defeat the current duplicate guard.

### Keep site click permissions explicit

The existing never-click guard remains authoritative on the claim page. Only the program-choice step's Next control may be used to reach a claim form. Duplicate popups are answered No. Successful entry still stops for the person to review and submit the claim.

## Risks / Trade-offs

- [Site navigation or sign-in stalls] → Bound waits, permit Stop, and show an actionable attention state without adding lines.
- [Same-month page is a different draft] → Require in-memory sales from the current run to still be visible after recovery; otherwise stop rather than infer continuity.
- [Site markup or program list changes] → Fail closed when the month or key controls cannot be verified, log technical detail, and show plain-language next steps.
- [Person changes pages during a single site action] → Re-read page state after navigation and before upload; retain the existing fill/add verification and duplicate checks. A concurrent mutation may still require manual review, so do not automatically retry a partially completed Add.

## Migration Plan

No stored-data migration is needed. Ship through the normal app update path. Rollback restores the prior navigation behavior without changing saved matches, settings, password, or cookies.
