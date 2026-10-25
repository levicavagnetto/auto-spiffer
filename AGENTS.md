# Auto Spiffer: agent guide

Read this file first. Then read `docs/architecture.md`, and `docs/ui.md` before any UI work.

## What the app does

A tire shop sells about 50 tires a month. To earn the ATD **ProRewards** incentive ("spiff") on each
eligible tire, someone types every sale into the ProRewards "Submit a Sales Claim" web page and uploads
the invoice PDFs. Auto Spiffer does that typing:

1. The person picks the month's **Material Sales export** (`.xlsx`, from Protractor, the shop's
   software) and the month's **invoice PDFs**.
2. The app opens the ProRewards site **in a tab inside the app**, signs in (saved cookies first, then a
   saved password), and opens the claim page for that month's program.
3. It reads the **tire list** from the claim page's Eligible Product dropdown.
4. It **matches** each sale's tire description to a tire on that list. Saved matches the person made
   earlier are used first. Anything it is not sure about waits for the person on the Review screen.
5. It **enters** each sale on the claim page, checks that the line appeared, and uploads that invoice's PDF.
6. It **stops**. The person looks over the page and submits the claim themselves.

Version 1.0.0 is a ground-up rewrite. The previous app (v0.4.0, Python and Tkinter) is on the `legacy`
branch (`git show origin/legacy:<path>`) and in the `v0.x` tags. Use it as a reference for proven site
behavior and the tire-matching rules, not as code to port line by line.

## Hard rules

- **Never submit.** The app never clicks Next, Back, Submit, Save Claim, or "Yes" on the site's duplicate
  warning. This is enforced in code by a never-click list (`docs/site-reference.md`), and tested.
- **Never enter a line twice.** Before adding a line, read the page's Cumulative Sale(s) List and skip a
  line already there. On the duplicate popup, answer No.
- **No month memory.** Do not store which months, invoices or lines were entered. The only things the
  app remembers are tire matches the person chose, settings, the encrypted password and the site's cookies.
- **Real data never goes in git.** Real sales exports, invoice PDFs, saved site pages, dealer IDs and
  invoice numbers live only in the gitignored `private-data/` folder. Committed tests and docs use made-up
  invoice numbers. The tire names on the claim page are public program information and may be committed.
- **Only confident matches are entered.** A tire the app is not sure about is never guessed.
- **Plain language.** Messages shown to the person say what happened and what to do, in words a shop
  manager uses. Technical detail goes to the log.

## Stack (decided, see `docs/architecture.md` for why)

- **Electron** with **electron-vite**, **TypeScript** (strict) everywhere, **npm**.
- Renderer: **React 19**, **Tailwind CSS v4**, **shadcn/ui** (lucide icons), the Geist font.
- Main process: **ExcelJS** (sales export), **pdfjs-dist** (invoice numbers), Electron's own
  `WebContentsView` + `webContents.debugger` + `executeJavaScript` to drive the site (no Playwright at
  runtime, no open debugging port), **electron-store** (tire matches and settings), **safeStorage**
  (password), **Zod** (validate everything read from disk or sent over IPC), **electron-log**.
- Packaging: **electron-builder** (NSIS, per user) and **electron-updater** (GitHub Releases).
- Tests: **Vitest** for logic, **Playwright** (`_electron`) for end-to-end tests of the app against the
  saved claim page. Windows 11 is the only target.

## Where things are

| Path | What |
|---|---|
| `docs/architecture.md` | Processes, data flow, security boundaries, storage, risks |
| `docs/ui.md` | Screens, colors, type, logo, component choices |
| `docs/site-reference.md` | The ProRewards pages: selectors, controls, scripts that work, never-click list |
| `docs/matching.md` | The tire-matching algorithm and its known test cases |
| `docs/reference/tire-list-2026-10.txt` | The October 2026 Eligible Product list, word for word |
| `docs/brand/logo.svg` | The logo |
| `openspec/changes/` | The planned work, one change per milestone, in build order |
| `private-data/` (gitignored) | Real files: saved site pages, a sales export, legacy PDF fixtures, the mockup sources |

## How work is planned and done

Work is planned with [OpenSpec](https://github.com/Fission-AI/OpenSpec). Each change in
`openspec/changes/` has `proposal.md`, `design.md`, `specs/` and `tasks.md`. Build the changes **in their
numbered order** (the `NN-` prefix in each proposal's title), one at a time:

1. Read the change's proposal, design and specs.
2. Work through `tasks.md` in order, ticking each box when its check passes.
3. Run `openspec validate <change> --strict`, then the tests, before calling a change done.
4. Archive it with `openspec archive <change>` so its specs move into `openspec/specs/`.

If something in a spec turns out to be wrong or impossible, update the change's artifacts first and say
why, then build. Ask the user before changing a decision listed in `docs/architecture.md`.

## Tests and private data

- `npm test` runs Vitest; `npm run test:e2e` runs the Playwright tests.
- Tests that need `private-data/` must **skip, not fail**, when it is missing (CI and other machines do not
  have it). Name them `*.private.test.ts` so they are easy to find.
- Make committed fixtures from scratch (a small generated `.xlsx`, a generated PDF, a trimmed copy of the
  claim page with no dealer data), not by copying files from `private-data/`.
