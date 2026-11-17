# tire-matching Specification

## Purpose
Matches every tire sale to exactly one tire on the claim page's list, holds back anything uncertain, and lets
the person settle it on the Review screen.

## Requirements

### Requirement: The tire list comes from the claim page
Matching SHALL use the Eligible Product list read from the claim page open in the ProRewards tab, and no other
list. Each label SHALL be split into brand, model and category as described in `docs/matching.md`; labels with
no category that end in "Wheel" or "Wheels" SHALL be wheels and never matched to a sale.

#### Scenario: Claim page not open
- **WHEN** the person clicks Match tires and the tab is not on the claim page
- **THEN** the app says "Open the claim page for September 2026 in the ProRewards tab first." and offers to show the tab

#### Scenario: Label split
- **WHEN** the list has "Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES"
- **THEN** its brand is Hercules, its model "Strong Guard ST Trailer" and its category "Boat Trailer"

### Requirement: Match each tire sale
Each tire sale SHALL be **Ready** (one tire), **Needs a decision** (a guess, up to three scored suggestions and
a reason) or **Not eligible** (with a reason), by the rules in `docs/matching.md`. A model code that differs in a
digit, roman numeral or short letter code SHALL never be Ready without the person deciding. Every "Known case" in
`docs/matching.md` SHALL behave as listed.

#### Scenario: Exact name
- **WHEN** a sale reads "235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)"
- **THEN** it is Ready with "General Altimax RT45 - Passenger Tires"

#### Scenario: Look-alike model code
- **WHEN** a sale reads "GEN ALTIMAX RT43 205/55R16"
- **THEN** it Needs a decision, with General Altimax RT45 as the guess and a reason that names RT43

#### Scenario: Short code missing
- **WHEN** a sale reads "245/55R19 103H NOK ONE BW 80K 245/55R19 103H (80K)"
- **THEN** it Needs a decision, with Nokian One HT as the guess and a reason that names HT

#### Scenario: Brand not on the list
- **WHEN** a sale reads "ST185/80R13/8 CAR RADIAL TRAIL HD ST185/80R13/8 BW M"
- **THEN** it is Not eligible because Carlisle is not on the claim page

#### Scenario: Brand name inside a model name
- **WHEN** a sale reads "205/40ZR17XL 84W IRON iMOVE GEN 3 AS 40K"
- **THEN** it is Not eligible because Ironman is not on the claim page, not matched as a General tire

#### Scenario: Full brand name with a load range
- **WHEN** a sale reads "LT285/50R22 121/118R E Toyo Open Country A/T III BLK"
- **THEN** it is Ready with "Toyo Open Country A/T III - Light Truck Tires"

### Requirement: Merge split rows
Sales with the same invoice, sale date, status and tire SHALL become one line with their quantities added.
Different tires on one invoice SHALL stay separate lines. A merged line SHALL show that it was added up.

#### Scenario: One tire on two rows
- **WHEN** one invoice has "HER TERRA TRAC AT X-JOURNEY ..." twice, qty 1 and qty 3
- **THEN** Review shows one line of qty 4, marked as added up from 2 rows

#### Scenario: Two tires on one invoice
- **WHEN** one invoice has a Falken Aklimate and a Continental SecureContact AW
- **THEN** Review shows two lines

### Requirement: Program dates
A Ready line whose sale date is outside the program's first and last dates (read from the claim page) SHALL be
held back as **Outside program dates**, with both dates in the reason, and never entered.

#### Scenario: Sale from the wrong month
- **WHEN** a Ready line's date is 08/31/2026 and the program runs 9/1/2026 to 9/30/2026
- **THEN** the line is Outside program dates and not counted as ready

### Requirement: Review screen

The Review screen SHALL list every line (tire lines, Possible wheel lines, and Not a tire rows) in a table whose columns are, in order: Include, Status, Type, Date, Invoice, On the report, Qty and PDF, as in `docs/ui.md`. The On the report cell SHALL show the report's description and, as a muted second line, the chosen tire or wheel product, the guess with a `?`, or why the line is not entered. It SHALL filter by status with counts, including a Wheels filter, search by invoice, description, tire or wheel product, and summarize ready lines and items. The **Enter N sales** action SHALL appear at the right of the page header, show the number of ready, included lines, and stay disabled, with the reason beside it, while any included line Needs a decision. It SHALL also be disabled when no included lines are ready.

#### Scenario: Lines needing a decision

- **WHEN** two included lines Need a decision
- **THEN** Enter is disabled and the page header says "Decide 2 tires to continue" beside it

#### Scenario: All decided

- **WHEN** the person settles the last line that needed a decision
- **THEN** the page header's Enter action shows the number of ready lines and becomes available

#### Scenario: No ready lines

- **WHEN** no included lines are ready to enter
- **THEN** the page header's Enter action is disabled

#### Scenario: Chosen item under the description

- **WHEN** a line is Ready with "Nokian One HT - Light Truck Tires"
- **THEN** the On the report cell shows the description and, under it in muted text, "Nokian One HT - Light Truck Tires"

#### Scenario: Type pill

- **WHEN** the table shows a tire line and a possible or approved wheel line
- **THEN** the tire line has a Tire pill and the wheel line a Wheel pill, each in its own color, and Not a tire rows have none

#### Scenario: Sort by a column

- **WHEN** the person clicks the Qty header
- **THEN** the lines sort by quantity, smallest first; a second click sorts largest first, and a third returns to the report order

#### Scenario: Old columns are gone

- **WHEN** the Review table is shown
- **THEN** it has no Claim page tire column and no This month column

#### Scenario: Wheels filter

- **WHEN** Review contains possible or approved wheel lines
- **THEN** the Wheels filter shows their count and selecting it shows them in the same table

#### Scenario: Wheels in All

- **WHEN** Review contains possible wheel lines
- **THEN** they remain visible in All and are excluded from the generic Not a tire filter

#### Scenario: Manual wheel guidance

- **WHEN** the Wheels filter is selected
- **THEN** a note says to open a wheel and choose ATD Custom Wheels or ATD Steel Wheels to have it entered

### Requirement: Settle a line

Clicking anywhere on a row, or pressing Enter or Space on the row's On the report cell (a button), SHALL open the side panel for that line, whatever its status. Clicking the row's Include checkbox SHALL NOT open the panel. The panel SHALL show the invoice, date, quantity and report text, then one of two forms, chosen by what the line is:

- **Tire** (any line not treated as a wheel): titled **Which tire is this?**, with what was read (brand, size, model words), the suggestions with scores and reasons, a search over every tire on the claim page, "Remember this choice" (on by default), and the actions "Use <tire>", "Not an eligible tire" and "This is a wheel".
- **Wheel** (a Possible wheel line, or a line whose chosen product is a wheel product): titled **Which wheel is this?**, with a choice among the wheel products on this month's claim page (ATD Custom Wheels, ATD Steel Wheels), "Remember this choice" (on by default), and the actions "Use <wheel product>", "Not an eligible wheel" and "This is a tire".

"This is a wheel" and "This is a tire" SHALL switch the panel to the other form without changing the line until the person makes a choice. Choosing SHALL update the line, and every other line with the same wording, at once.

#### Scenario: Open a row

- **WHEN** the person clicks the date of a Ready line
- **THEN** the side panel opens for that line

#### Scenario: Open a row from the keyboard

- **WHEN** the row's On the report button has focus and the person presses Enter
- **THEN** the side panel opens for that line

#### Scenario: Pick the suggested tire

- **WHEN** the person opens the "NOK ONE" line and clicks Use Nokian One HT
- **THEN** the line becomes Ready with Nokian One HT, and so does every other line with that wording

#### Scenario: Not eligible

- **WHEN** the person clicks Not an eligible tire
- **THEN** the line becomes Not eligible ("you marked this as not eligible")

#### Scenario: Override a ready line

- **WHEN** the person opens a Ready line and picks a different tire
- **THEN** the line uses the tire they picked

#### Scenario: Possible wheel opens the wheel form

- **WHEN** the person opens a Possible wheel line
- **THEN** the panel is titled Which wheel is this? and offers only the wheel products on the claim page, with no tire picker

#### Scenario: Tire line opens the tire form

- **WHEN** the person opens a tire line
- **THEN** the panel is titled Which tire is this? and shows no wheel product choice

#### Scenario: Mark a tire line as a wheel

- **WHEN** the person opens a tire line, clicks This is a wheel, and then clicks Use ATD Custom Wheels
- **THEN** the line becomes Ready with ATD Custom Wheels

### Requirement: Approve a wheel

A wheel line SHALL be entered only after the person, or a saved choice, picks a wheel product. Approving SHALL make the line Ready with that product and count it in Enter N sales. An unapproved Possible wheel SHALL NOT be entered and SHALL NOT keep Enter disabled. When the claim page lists no wheel product, the wheel form SHALL say "This month's claim page has no wheel products, so wheels can't be entered." and offer no Use action.

#### Scenario: Approve as Custom Wheels

- **WHEN** the person opens a Possible wheel line, picks ATD Custom Wheels and clicks Use ATD Custom Wheels
- **THEN** the line becomes Ready with "ATD Custom Wheels" and Enter counts it

#### Scenario: Steel wheels

- **WHEN** the claim page offers ATD Custom Wheels and ATD Steel Wheels and the person picks ATD Steel Wheels
- **THEN** the line becomes Ready with "ATD Steel Wheels"

#### Scenario: Only one wheel product

- **WHEN** the claim page offers ATD Custom Wheels but not ATD Steel Wheels
- **THEN** the wheel form offers only ATD Custom Wheels

#### Scenario: No wheel products

- **WHEN** the claim page lists no wheel product
- **THEN** the wheel form shows the no-wheel-products message and no Use action, and wheel lines stay Possible wheel

#### Scenario: Wheel not eligible

- **WHEN** the person clicks Not an eligible wheel
- **THEN** the line becomes Not eligible ("you marked this as not eligible")

#### Scenario: Unapproved wheel

- **WHEN** Review has one ready tire and one Possible wheel that nobody approved
- **THEN** Enter shows one sale and the run enters only the tire

### Requirement: Include lines with checkboxes

Each Ready or Needs a decision line SHALL have an **Include** checkbox in the first column, ticked by default; other lines SHALL have none. Left-out lines SHALL not be entered and SHALL not block Enter, and the choice SHALL not outlive the sales file or an app restart. A header checkbox SHALL include or leave out every line with a checkbox in the current view.

#### Scenario: Leave out a line

- **WHEN** the person unticks a line that Needs a decision
- **THEN** it shows as Left out, and it no longer keeps Enter disabled

#### Scenario: Include it again

- **WHEN** the person ticks a left-out line
- **THEN** it is counted again

#### Scenario: Clear all in a filter

- **WHEN** the Needs a decision filter is selected and the person unticks the header checkbox
- **THEN** every line in that filter is left out, and lines in other filters are unchanged

#### Scenario: Mixed state

- **WHEN** some, but not all, lines with a checkbox in the current view are included
- **THEN** the header checkbox shows a mixed state

#### Scenario: Checkbox does not open the panel

- **WHEN** the person clicks a row's Include checkbox
- **THEN** the include state changes and the side panel does not open
