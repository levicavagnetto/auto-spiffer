# 06 · Sign-in and navigation

## Why

Until now the person signs in and picks the program by hand in the tab. The app can do both: keep the site's
login between sessions, sign in with a saved password when the login has expired, and open the month's claim page
by itself, so the month starts with no clicking around the website.

## What Changes

- **Stay signed in**: the tab's cookies persist (from change 02); a setting can turn this off, which clears them
  when the app closes.
- **Saved password**: an email and password saved in Settings, the password encrypted with the Windows account.
  Used once when the site shows its login page; never retried.
- **Go to the claim page**: from anywhere on the site, open Submit Sale, pick the one program for the month, click
  that step's Next, and confirm the claim page opened. If anything is unclear, stop and let the person finish by
  hand; the app notices when the claim page appears.
- The ProRewards sign-in card in Settings, the sign-in state in the sidebar, and the live ProRewards card on the
  Sales screen.

## Capabilities

### New Capabilities
- `site-sign-in`: staying signed in, the saved password, automatic sign-in and navigation to the month's claim page.

### Modified Capabilities
- None.

## Impact

- `src/main/site/signin.ts`, `src/main/site/navigate.ts`, the credentials store, Settings and Sales screen cards.
- **Blocked on a saved copy of the program choice page.** The user will save it into `private-data/site-pages/`.
  Build the sign-in parts first; build the program choice against the saved page when it is there.
- Depends on `add-site-tab-driver`.
