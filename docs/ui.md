# UI

The mockups were made on a design canvas; their sources are in `private-data/mockups/*.dc.html` (gitignored,
because they show real sales). Open them in a text editor for exact layout, spacing and copy. This file is the
summary to build from.

## Look

- **shadcn/ui** components (new-york style) on **Tailwind CSS v4**, **lucide** icons, the **Geist** and
  **Geist Mono** fonts (bundled with the app, not loaded from the web).
- A fixed left **sidebar** (248 px) and one screen at a time on the right, each with a 60 px header
  (step label and title on the left, the main action or a status chip on the right).
- The native window title bar and controls remain, without Electron's File/Edit/View/Window menu bar.
- Minimum window 1100 × 700; default 1280 × 800. Layouts reflow down to the minimum; tables scroll inside
  their own box.
- Review and Enter claims hide app scrollbar tracks while keeping page, table, panel and detail areas scrollable.
- Light and dark themes, following Windows by default, switchable in Settings (Light, Dark, Same as Windows).
- Radius 8 px for controls, 10 to 12 px for cards. Hairline borders, not shadows, except the side sheet.

## Colors

A higher-contrast blue palette. Define app colors as CSS variables in the shared theme file, never as a
literal in a component. The workspace, sidebar, header, cards, and table headers have distinct surfaces.
The embedded ProRewards website retains its own colors.

| Token | Light | Dark | Use |
|---|---|---|---|
| background | `#EEF3F9` | `#0B1428` | workspace |
| sidebar | `#E3EBF5` | `#101D38` | navigation |
| header | `#FFFFFF` | `#101B34` | screen header |
| card | `#FFFFFF` | `#14223E` | cards, table, side sheet |
| muted | `#DCE7F4` | `#172746` | subtle fills and tab track |
| table-header | `#DCE7F4` | `#24385C` | Review table header |
| table-alternate | `#F5F8FC` | `#182945` | alternating Review rows |
| nav-active | `#C8DDF8` | `#294778` | selected navigation item |
| nav-active-foreground | `#173C70` | `#FFFFFF` | selected navigation text |
| wheel / wheel-foreground | `#E7E8FA` / `#4D5594` | `#30385D` / `#C4D0FF` | possible-wheel status |
| border | `#C5D4E6` | `#3A5383` | dividers and outlines |
| foreground | `#182842` | `#F5F8FF` | main text |
| muted-foreground | `#516784` | `#AAB9D7` | secondary text |
| primary / primary-foreground | `#245B9A` / `#FFFFFF` | `#67B6FF` / `#08172E` | filled buttons and progress bar |
| accent | `#1D609E` | `#79BDFF` | links and focus outline |
| info / info-foreground | `#E0ECFA` / `#245B9A` | `#17365D` / `#B9DCFF` | active information |
| success / success-foreground | `#DCF2E8` / `#176548` | `#143D35` / `#8AE0B4` | success states |
| warning / warning-foreground | `#FFF0CF` / `#794400` | `#4A350E` / `#FFD17B` | attention states |
| destructive / destructive-foreground | `#FCE8E6` / `#A32921` | `#4A2026` / `#FFC1BB` | error states |
| scrim behind the side sheet | `rgba(1,16,46,.4)` | `rgba(0,0,0,.55)` | |

Success, warning, and error colors remain distinct from the blue brand palette. The logo itself retains its
existing artwork colors. The two Review mockups in `private-data/mockups/` are visual references only; their
sample content and layout are not part of the app theme.

## Logo

`docs/brand/logo.svg`: three stacked upward chevrons (`#D2E8FB`, `#79B9F2`, `#208BE9`, top to bottom) on a
`#244A7C` rounded tile (64 × 64, radius 15). It reads as a tread pattern and as moving forward. Shown at 28 px
in the sidebar next to "Auto Spiffer" (Geist 600, 15 px). The packaging change makes the `.ico` and installer
images from it.

## Sidebar

From top: the logo and name; a **This month** card (`September 2026`, `Sep 1 to Sep 30 · 46 tire lines`);
**Monthly claim** with **Sales**, **Review**, **Enter claims** (each shows its step number, a check when done,
the number of lines needing a decision on Review, or `10/21` progress while entering); **Website** with
**ProRewards** and its sign-in state (dot + "Signed in" / "Signed out"); at the bottom **Saved matches** (with
the count) and **Settings**; then `Version 1.0.0 · up to date`. The current item has the muted fill and medium
weight. Review and Enter claims are disabled, with a tooltip saying why, until the earlier step is done.
The sidebar stays visible while a long screen scrolls. If its own contents exceed the window height, the sidebar
scrolls internally so every navigation item remains reachable. Choosing a different screen starts that screen at
the top.

## Screens

### 1. Sales (step 1)
One content column; the cards use the available page width.
- **Material Sales export** card: the chosen file (name, "Sales from Sep 1 to Sep 30, 2026", Replace), and three
  figures: rows in the file, tire lines, rows left out ("1 tube, 2 shipping").
- **Invoice PDFs** card: Add PDFs button and a drop zone ("Drop more PDFs or a whole folder here"); a summary
  ("41 PDFs loaded, 40 linked to a sale"); a warning box listing sales with no PDF ("They are still entered.
  Upload those PDFs on the website yourself."); a quiet note for PDFs whose invoice is not in the month's sales.
- Header action: primary **Match tires** at the far right, disabled before an export is loaded.
- Match tires loads and signs in to ProRewards in the background while Sales remains visible. On success it opens Review. If sign-in or matching cannot finish, a temporary error toast appears on Sales with the next step; sign-in failure begins "Could not log in".
- The ProRewards sidebar item remains the way to open the website and see sign-in state.
- Empty state: one large drop zone for the Excel file, with a Choose file button.

### 2. Review (step 2)
- Header action: primary **Enter N sales** at the far right, disabled with "Decide 2 tires to continue" beside it
  while any line needs a decision. It stays reachable while the Review list scrolls.
- A segmented filter: All, Ready, Needs a decision (warning color), Not eligible, Wheels, Not a tire, each with its
  count; a search box (invoice or tire).
- Wheels shows likely wheel rows as "Possible wheel" in the same table, without a tire choice. Its note says:
  "These rows look like wheels. Check whether they qualify for ATD Custom Wheels or ATD Steel Wheels, then enter them on ProRewards yourself."
- A table: Status (a pill with a dot), Date, Invoice (mono), On the report (muted, ellipsis), Claim page tire
  (bold when Ready, warning color with `?` for a guess, muted "Not on the claim page" or "Not a tire"),
  Qty (right-aligned, `*` when merged), PDF (check or dash). The selected row has the warning tint.
- A footer summary: "19 ready (65 tires) · 2 need a decision · 18 not eligible · 3 not a tire".
- **Which tire is this?** side sheet (440 px, from the right, over a scrim), opened by clicking a row:
  invoice, date and quantity; the report text in mono with the model words highlighted; chips for Brand,
  Size, Model; **Best guesses** as radio cards with match percentages and the reason ("HT is not on the
  report"); a search over all tires on the claim page; **Remember this choice** (on by default; "Next time
  'NOK ONE' is matched without asking"); buttons **Not an eligible tire** and **Use <tire>**.
- A row menu also offers **Leave this line out** / **Include this line** (not remembered between months).

### 3. Enter claims (step 3)
Two panes.
- Left (380 px): one panel structure in every phase. The top shows "11 of 21 sales", a shadcn Base UI progress bar using the theme's primary fill and muted track, and Ready to enter, Entering sales, Paused, Finished entering, or Run stopped. A compact card shows the plan, current invoice and tire, or run results, plus the page-check result. The controls below it are Start entering, Pause/Resume and Stop, or Check page and run again. Two expandable sections show Activity and PDFs needing upload; routine missing-PDF notices are grouped in the latter, with clickable invoice numbers that copy individually. Activity retains sale results and failures, including page pictures. The detail area scrolls while controls and the submission reminder remain visible.
- Right: the **ProRewards tab** itself (the real `WebContentsView`, laid out in this area), under a slim bar
  with Reload, the address, and a chip "Auto Spiffer is typing" while a run is going.
- The webpage itself has square corners. A slim bottom bar sits below it on this screen and the ProRewards sidebar
  screen; the containing card rounds the bottom bar's lower corners.
- Before a run, the PDF section counts all ready invoices without a linked PDF. During entry it counts processed invoices needing manual upload. After a run, it expands by default and includes missing and failed uploads without duplicates. The ProRewards tab remains usable beside the panel.
- After Check page and run again, invoices without linked PDFs remain in PDFs needing upload even when their sales were already on the claim page.

### ProRewards (sidebar item)
The same tab, full width, for signing in by hand or looking at the site.

### Settings
Two independent columns of cards. ProRewards sign-in and Updates stack on the left; Appearance and Logs stack on the right. Each card fits its contents, with no row-sized gap between Appearance and Logs.
- **ProRewards sign-in**: Email, Password ("Saved, encrypted with your Windows account", Change), **Stay signed
  in** switch, **Sign out and forget password** (destructive text).
- **Appearance**: Light, Dark, Same as Windows.
- **Updates**: version and status, Check now, "Install updates automatically".
- **Logs**: Open folder.

### Saved matches (sidebar)

- Count, search, and a list of `report wording → tire` (or "Not an eligible tire"), each removable, "Show all".

## Copy

Short, plain sentences in the shop's words: "sales", "tires", "invoice", "claim page", "Needs a decision".
No exclamation points. Buttons say what happens ("Match tires", "Use Nokian One HT", "Start entering").
Errors say what went wrong and what to do.
