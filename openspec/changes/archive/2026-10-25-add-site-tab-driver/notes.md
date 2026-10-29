# Verification notes

On 2026-10-25, the user chose to defer task 4.1 because they had no eligible sale available for a live check.
No sale was added or PDF uploaded on the live ProRewards website during this change. The live result and timings
are therefore unknown; task 4.1 remains unchecked.

The local verification passed: `openspec validate add-site-tab-driver --strict`, `npm run check` (19 Vitest tests
and 18 Electron end-to-end tests), including Add outcomes and PDF upload against the saved claim page and a
test-only server stub. A normal Electron launch was also checked for absence of a remote debugging port.

The first real claim run should confirm that the site's Add and PDF upload controls work with the in-app view.
If either fails, stop and discuss Plan B from `design.md` before changing the driver. The app must still leave
Next and Submit to the person.
