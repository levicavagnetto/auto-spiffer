# Architecture

Auto Spiffer 1.0 is one Electron app, written in TypeScript. The ProRewards website runs in a tab inside
the app, and the app drives that tab from inside itself: no second program, no open network port, no
separate browser window.

## Block diagram

```
                              ProRewards website
                       (login, Submit Sale, claim page)
                                     ^
                                     | HTTPS, session cookies
+------------------------------------|---------------------------------------------+
| Electron app                       |                                             |
|                                    |                                             |
|  +----------------+        +-------+-----------+                                 |
|  | Renderer       |        | ProRewards tab    |                                 |
|  | React+shadcn   |        | WebContentsView   |                                 |
|  | Sales, Review, |        | own session,      |                                 |
|  | Enter claims,  |        | saved cookies,    |                                 |
|  | Settings       |        | no Node/preload   |                                 |
|  | sandboxed      |        +-------------------+                                 |
|  +-------+--------+                ^          ^                                  |
|          | typed IPC               | creates  | drives (webContents.debugger +    |
|          | (preload bridge)        | shows    |  executeJavaScript, in process)   |
|  +-------v-------------------------+----------+-------------------------------+  |
|  | Main process (Node)                                                        |  |
|  |  Sales reader (ExcelJS)      Invoice reader (pdfjs-dist, worker thread)    |  |
|  |  Matcher (saved matches first, then rules)   Planner (merge, link PDFs)    |  |
|  |  Site driver (tire list, page check, fill, verify, upload, never-click)    |  |
|  |  Store (electron-store: matches, settings; safeStorage: password)          |  |
|  |  App shell (window, tab layout, single-instance lock, updater, logs)       |  |
|  +----------------------------------------------------------------------------+  |
+-----------^-----------------------------^-------------------------^--------------+
            | reads (person picks them)   | reads, writes           | updates
     material_sales.xlsx            %APPDATA%\Auto Spiffer     GitHub Releases
     invoice PDFs                   (matches, settings, logs)
```

- The **renderer** (the screens) only talks to the main process, through a preload bridge that exposes a
  small, typed API. It never touches files, the site or Node.
- The **main process** does all the work. It is the only part that reads files, writes saved data or
  touches the ProRewards tab.
- The **ProRewards tab** is the real website with none of the app's code inside it.

## One month, start to finish

1. **Sales.** The person picks `material_sales.xlsx` and the invoice PDFs. The month comes from the sale
   dates. Each PDF is linked to its sale by the invoice number printed inside it.
2. **Sign in.** The app opens the ProRewards tab. Saved cookies skip the login. Otherwise the saved
   password is tried once.
3. **Program.** The app picks the month's program on Submit Sale and opens the claim page (step 3 of the
   site's wizard). If it cannot, the person does it by hand in the tab and the app notices.
4. **Tire list.** The app reads the Eligible Product dropdown, the promotion name and the allowed date
   range from the claim page.
5. **Review.** Each sale is matched to a tire. The person decides anything uncertain; those choices are
   saved and reused next month.
6. **Enter.** The app checks the page, then enters each line, confirms it in the page's sale list, and
   uploads the invoice's PDF. Lines already on the page are skipped.
7. **Stop.** The person reviews the tab and clicks the site's Next and Submit themselves.

## Decisions

| Decision | Why |
|---|---|
| All TypeScript in Electron, no Python | The inputs became an Excel file and HTML pages, so Python's PDF strength no longer matters. One process tree avoids a second runtime, a process supervisor, PyInstaller and an open debugging port. |
| Site in a `WebContentsView`, driven in process | No separate Chrome or Edge window, no dependency on an installed browser, cookies kept in the app's own session, and nothing reachable from outside the app. |
| Tire list from the live dropdown | The dropdown is exactly what gets entered, so it is the authority. No ClaimForm PDF parsing. The payout value per tire is not needed. |
| Material Sales as `.xlsx` | Typed dates and numbers, one row per line. No PDF table parsing. |
| No month memory | The person knows which months were submitted; the old record got in the way. Duplicates are prevented by reading the page itself. |
| electron-store, not SQLite | The saved data is small (tire matches, settings). Atomic JSON writes, no native module to rebuild. |
| Playwright only in tests | Playwright cannot attach to an in-app tab without a debugging port. Electron's own APIs drive the tab at runtime; Playwright drives the whole app in tests. |
| electron-builder + electron-updater | A standard installer and silent updates from GitHub Releases, replacing the old hand-built updater. |

## Security boundaries

- **Renderer:** `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`. Loads only the app's
  bundled files. A strict Content-Security-Policy. It can only call the functions the preload bridge
  exposes, and every IPC payload is checked with Zod in the main process.
- **ProRewards tab:** its own session partition (`persist:prorewards`), no preload, no Node. New windows
  and pop-ups from the site open in the person's normal browser (`shell.openExternal`), except the
  ClaimForm link, which is simply left alone. Navigation stays on the ProRewards domain; anything else
  opens externally.
- **Main process:** opens no ports. The password is encrypted with `safeStorage` (Windows DPAPI). The
  never-click list is enforced by the site driver for every click it makes.

## Storage

Everything lives in the user's app data folder (`%APPDATA%\Auto Spiffer`), which installs and updates
never touch.

| Kept | Where |
|---|---|
| Saved tire matches: report wording to an exact dropdown tire, or "not eligible" | electron-store |
| Settings: saved username, stay signed in, theme, update preference, window size | electron-store |
| Password | safeStorage-encrypted string in electron-store |
| Site cookies | the tab's persistent session partition |
| Logs, and a screenshot of the page for any line that failed | `logs\` folder |

Not stored: sales files (they are read where they are), which months or lines were entered, uploads.

## Risks and how they are handled

| Risk | Handling |
|---|---|
| Driving the tab with Electron's own debugger is unproven: Telerik date and number boxes, the Chosen dropdown, Add, and above all file uploads | Change `02` proves it first, against the saved claim page and then the live site. Plan B: Playwright for Node launching Edge, as the old app did, behind the same site driver interface. |
| Waiting for the page is our own code (no Playwright auto-wait) | Small, tested wait helpers that watch the page's ASP.NET request counter and the sale list, as the old app did. |
| The only duplicate guard is the live page | Accepted. Lines removed from the page, or a month already submitted, are not caught; the person knows which months they submitted. |
| Brand and model come from one dropdown label | Split with the brand table, as the old app did with the same text. Tested against the real list. |
| Reading many PDFs could make the window stutter | Read them in a worker thread. |
| An update could install during a run | The updater waits until no run is going, then closes the tab first. |
| Two copies of the app open at once | Single-instance lock: the second launch focuses the first window. |
| Unsigned installer warning | Optional code signing later. |

## Not in 1.0

ClaimForm parsing, payout estimates, CSV exports, tire list history and diffs, a command line, a
"test mode" in the shipped app, importing the old app's saved data, Supplier filtering (the export's
Supplier column is ignored), editing quantities.
