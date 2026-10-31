# Design

The existing `WebContentsView` remains attached to the Electron window and can load with visibility off. Add an idempotent `ensureLoaded` operation and call it from Match tires before navigating to the month's claim page. Navigation for this action uses an unattended mode: when the site requires a person, return an error instead of switching tabs and waiting for manual completion. Existing interactive navigation for claim entry keeps its handoff behavior.

The Sales screen remains current while the asynchronous IPC call runs. On success, store the review snapshot and switch to Review. On failure, show a dismissible error toast for seven seconds. A login failure shows exactly "Could not log in"; the person can open ProRewards to sign in manually. No credentials or site content enter the renderer beyond the existing status and error messages.

The site login controller shares an in-progress attempt between callers. It checks the site's `.errorLiteral` after clicking Log in and otherwise waits at most 10 seconds. Saving replacement credentials cancels any old wait and permits a new attempt. The Match tires toast strips Electron's IPC wrapper and shows exactly "Could not log in" for sign-in failures.
