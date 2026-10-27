# Tasks

## 1. Credentials and state

- [x] 1.1 The credentials store (design D1) and the Settings sign-in card (email, password, Stay signed in, Sign out and forget password); verify unit tests that the stored file never contains the password and that saving is refused without encryption, and an e2e test of the card
- [x] 1.2 `whereAmI()` (design D2) and the sign-in state in the sidebar and the Sales screen's ProRewards card; verify tests against the saved login, home and claim pages (private) and the trimmed claim fixture

## 2. Sign in

- [x] 2.1 Sign in once (design D3) with the 20 s limit and plain messages, run when the tab lands on the login page and a password is saved; verify private e2e tests against the saved login page with a stubbed postback (success, still on login after 20 s), and that it never retries by itself
- [x] 2.2 Stay signed in off clears the session on quit (design D5); verify an e2e test that cookies are gone after a restart

## 3. Program choice (needs the saved program page)

- [x] 3.1 Ask the user for the saved program choice page if `private-data/site-pages/` does not have it; add its selectors to `docs/site-reference.md`
- [x] 3.2 Choose the month's program and open the claim page (design D4), with the hand-off when unclear and the 2 s watch for the person finishing by hand; Match tires uses it; verify private e2e tests against the saved page for one match, none, two, and the claim page not appearing

## 4. Live check (with the user)

- [x] 4.1 With the user: start the app signed out with a saved password and go from Match tires to the claim page with no clicks; then with a wrong password, confirm the single try and the message. Record the results in `notes.md`

## Workflow follow-up

- Run `openspec validate add-site-sign-in --strict` and `npm run check`, then archive.
