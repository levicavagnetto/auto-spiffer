# 05 · Claim entry

## Why

With the lines decided and the claim page open, the app must enter every ready line, prove each one landed,
upload each invoice's PDF once, survive problems without stopping the whole run, and leave the page ready for the
person to submit. This is the step that saves the shop the most time, and the one that must never claim a tire
twice or submit anything.

## What Changes

- A **page check** before anything is typed: the right program, every date inside the program window, every
  tire on the page's list.
- The **run**: line by line in invoice order, skip lines already on the page, add the rest through the driver,
  retry a failed line once, picture and report failures, upload each invoice's PDF after its lines.
- **Pause**, **Resume** and **Stop**, acting between lines.
- The **Enter claims** screen: the plan, progress, the activity list, the tab beside it, and the summary.
- Safety: never click Next, Submit or Yes; refuse to start while another run is going or the claim page is not
  open.

## Capabilities

### New Capabilities
- `claim-entry`: the page check, the run and its controls, uploads, and the Enter claims screen.

### Modified Capabilities
- None.

## Impact

- `src/main/run/` (page check, runner, run control, events), the Enter claims screen.
- Uses `SiteDriver` from `add-site-tab-driver` and `Line[]` from `add-tire-matching`.
- No record of what was entered is kept after the run (by decision); the summary is shown and logged.
