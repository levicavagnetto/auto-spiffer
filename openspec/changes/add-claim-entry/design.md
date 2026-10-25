# Design

## Context

The old runner is `git show origin/legacy:auto_spiffer/fill.py` (`check_page`, `Filler`, `RunControl`,
`RunSummary`). `docs/site-reference.md` has the Add outcomes; `SiteDriver` (change 02) does each step. The
decision to keep no record of entered lines is in `docs/architecture.md`.

## Goals / Non-Goals

**Goals:** a runner that is safe to run twice, explains every outcome, and is fully testable against the stub.

**Non-Goals:** remembering entered lines or uploads across runs; editing or deleting lines on the site.

## Decisions

### D1. Runner (`src/main/run/runner.ts`)
```
checkPage(info, lines) -> { ok, problems[], warnings[] }
run(lines, driver, control, emit) -> RunSummary
  for each invoice group (date order, then invoice):
    for each line: control.checkpoint(); if stopped -> break
      existing = driver.readPage().lines matching (date, invoice, product)
      same qty -> alreadyThere; other qty -> failed
      else up to 2 attempts of driver.addLine(); duplicate -> no retry
      failed -> driver.screenshot()
    if any line of the group was added in this run and it has a PDF -> driver.upload()
  driver.scrollTop(); emit finished
```
`emit` sends typed events over IPC: `progress {done, total}`, `now {lineId}`, `activity {lineId, kind, text}`,
`finished {summary}`.

### D2. Run control
A small class with `pause()`, `resume()`, `stop()` and an async `checkpoint()` that waits while paused. Only one
run object exists at a time in the main process; a second start is rejected.

### D3. Close guard
`BrowserWindow` `close` is intercepted while a run is going: ask through a native dialog, then `stop()`, wait for
the run to end, then close. The updater (change 07) asks the runner whether a run is going.

### D4. Screen
Left pane 380 px (plan / progress / summary states), right pane the tab placeholder that change 02's view follows.

## Risks / Trade-offs

- The "upload only if a line was added in this run" rule can miss a PDF whose upload failed in an earlier run
  whose lines did go in. The earlier run's summary reported that failure; the person uploads it by hand. This is
  the cost of keeping no record.
