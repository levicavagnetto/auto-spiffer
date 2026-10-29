# UI

The mockups were made on a design canvas; their sources are in `private-data/mockups/*.dc.html` (gitignored,
because they show real sales). Open them in a text editor for exact layout, spacing and copy. This file is the
summary to build from.

## Look

- **shadcn/ui** components (new-york style) on **Tailwind CSS v4**, **lucide** icons, the **Geist** and
  **Geist Mono** fonts (bundled with the app, not loaded from the web).
- A fixed left **sidebar** (248 px) and one screen at a time on the right, each with a 60 px header
  (step label and title on the left, the main action or a status chip on the right).
- Minimum window 1100 × 700; default 1280 × 800. Layouts reflow down to the minimum; tables scroll inside
  their own box.
- Light and dark themes, following Windows by default, switchable in Settings (Light, Dark, Same as Windows).
- Radius 8 px for controls, 10 to 12 px for cards. Hairline borders, not shadows, except the side sheet.

## Colors

A blue variant of the Ubuntu/Canonical palette. Define every color as a CSS variable in the shadcn theme
file, never as a literal in a component.

| Token | Light | Dark | Use |
|---|---|---|---|
| background | `#FFFFFF` | `#01102E` (dark navy) | main area |
| sidebar | `#F5F6F7` (slate 10%) | `#0A1938` | sidebar |
| card | `#FFFFFF` | `#0D1E42` | cards, the side sheet |
| muted (subtle fills, tab track, selected nav) | `#ECEEF0` (slate 20%) | `#16294F` | |
| border | `#D9DDE1` (slate 40%) | `#243661` (mid indigo) | |
| foreground | `#10151C` (text grey) | `#F5F6F7` | |
| muted-foreground | `#5C6575` | `#9FA9B3` (cool slate) | secondary text |
| primary (filled buttons, progress bar) | `#244A7C` (Canonical blue), text `#FFFFFF` | `#4DA2ED` (azure 80%), text `#01102E` | |
| accent / brand / focus ring | `#208BE9` (azure) | `#4DA2ED` | logo, links, the outline on what the app is doing |
| info (the line being entered now) | bg `#E9F3FD`, text `#1A62A8` | bg `#12305E`, text `#A6D1F6` | |
| success (Ready, Signed in, added) | bg `#E6F4EA`, text `#1D6B38` | bg `#0D3122`, text `#7FD39F` | |
| warning (Needs a decision) | bg `#FDF3E1`, text `#8A4F00`, border `#EFC16A` | bg `#382909`, text `#F3C46A`, border `#8A5A00` | |
| destructive (Stop, failed, sign out) | bg `#FCEBEA`, text `#B3261E` | bg `#3B1416`, text `#F4A19A` | |
| scrim behind the side sheet | `rgba(1,16,46,.4)` | `rgba(0,0,0,.55)` | |

The palette has no green, amber or red, so the status colors above sit outside it on purpose. Azure is only
3.4:1 against white text, so it is never a filled button with white text.

Palette reference: azure `#208BE9` (tints `#4DA2ED #79B9F2 #A6D1F6 #D2E8FB #E9F3FD`), Canonical blue
`#244A7C`, light indigo `#2B4C9B`, mid indigo `#243661`, dark navy `#01102E`, cool slate `#9FA9B3` (tints
`#B2BAC2 #C5CBD1 #D9DDE1 #ECEEF0 #F5F6F7`), cool grey `#333A44`, text grey `#10151C`.

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
Two columns.
- **Material Sales export** card: the chosen file (name, "Sales from Sep 1 to Sep 30, 2026", Replace), and three
  figures: rows in the file, tire lines, rows left out ("1 tube, 2 shipping").
- **Invoice PDFs** card: Add PDFs button and a drop zone ("Drop more PDFs or a whole folder here"); a summary
  ("41 PDFs loaded, 40 linked to a sale"); a warning box listing sales with no PDF ("They are still entered.
  Upload those PDFs on the website yourself."); a quiet note for PDFs whose invoice is not in the month's sales.
- Right column: **ProRewards** card (Signed in badge, program, dates, "77 tires, read from the claim page",
  Show website) and **Ready to match** card (one sentence).
- Header action: primary **Match tires** at the far right, disabled before an export is loaded.
- Empty state: one large drop zone for the Excel file, with a Choose file button.

### 2. Review (step 2)
- Header action: primary **Enter N sales** at the far right, disabled with "Decide 2 tires to continue" beside it
  while any line needs a decision. It stays reachable while the Review list scrolls.
- A segmented filter: All, Ready, Needs a decision (warning color), Not eligible, Not a tire, each with its
  count; a search box (invoice or tire).
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
- Left (380 px): "11 of 21 sales" large, a progress bar, "Now: 200118 · Nokian Remedy WRG5 · qty 4", **Pause**
  (becomes Resume) and **Stop** (destructive text); the page check result ("Page check passed: right program,
  every date inside 9/1 to 9/30, all 21 tires in the list"); an activity list, newest first, each with a round
  status icon (added and checked, already on the page, retried, failed, PDF uploaded); and a fixed note: "Auto
  Spiffer never clicks Next or Submit. When it finishes, check the page and submit the claim yourself."
- Right: the **ProRewards tab** itself (the real `WebContentsView`, laid out in this area), under a slim bar
  with Reload, the address, and a chip "Auto Spiffer is typing" while a run is going.
- Before a run: the left pane shows the plan (N lines, N PDFs) and a primary **Start entering** button.
- After a run: a summary (entered, already on the page, failed with reasons, PDFs uploaded, uploads failed,
  sales without a PDF), and "Check the page, then click Next and Submit on the website." Keep the result counts,
  **Check page and run again** button, and submission reminder visible within the left pane. Group missing PDFs
  under a count and show invoice numbers in a compact list; the details scroll inside the pane when they do not
  fit, including at the minimum window size. The ProRewards tab remains usable beside it.

### ProRewards (sidebar item)
The same tab, full width, for signing in by hand or looking at the site.

### Settings
Two columns of cards.
- **ProRewards sign-in**: Email, Password ("Saved, encrypted with your Windows account", Change), **Stay signed
  in** switch, **Sign out and forget password** (destructive text).
- **Saved matches** (also reached from the sidebar): count, search, a list of `report wording → tire` (or "Not
  an eligible tire"), each removable, "Show all".
- **Appearance**: Light, Dark, Same as Windows.
- **Updates**: version and status, Check now, "Install updates automatically when no claim is being entered".
- **Logs**: Open folder.

## Copy

Short, plain sentences in the shop's words: "sales", "tires", "invoice", "claim page", "Needs a decision".
No exclamation points. Buttons say what happens ("Match tires", "Use Nokian One HT", "Start entering").
Errors say what went wrong and what to do.
