# tire-matching Specification

## Purpose
Matches every tire sale to exactly one tire on the claim page's list, holds back anything uncertain, and lets
the person settle it on the Review screen.

## Requirements

### Requirement: The tire list comes from the claim page
Matching SHALL use the Eligible Product list read from the month's claim page open in the ProRewards tab, and no other list. Before reading, the app SHALL navigate to that page when needed. Each label SHALL be split into brand, model and category as described in `docs/matching.md`; labels with no category that end in "Wheel" or "Wheels" SHALL be wheels and never matched to a sale.

#### Scenario: Claim page not open
- **WHEN** the person clicks Match tires and the tab shows another ProRewards page
- **THEN** the app opens the month's claim page and reads its live Eligible Product list before matching

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
The Review screen SHALL list every line (tire lines, Possible wheel lines, and Not a tire rows) with status, sale date, invoice, the report's description, the claim page tire (or the guess, or why not), quantity and whether it has a PDF, as in `docs/ui.md`. It SHALL filter by status with counts, including a Wheels filter, search by invoice or tire, and summarize ready lines and tires. The **Enter N sales** action SHALL appear at the right of the page header, show the number of ready tire lines, and stay disabled, with the reason beside it, while any tire line Needs a decision. It SHALL also be disabled when no tire lines are ready.

#### Scenario: Lines needing a decision
- **WHEN** two tire lines Need a decision
- **THEN** Enter is disabled and the page header says "Decide 2 tires to continue" beside it

#### Scenario: All decided
- **WHEN** the person settles the last tire line that needed a decision
- **THEN** the page header's Enter action shows the number of ready tire lines and becomes available

#### Scenario: No ready lines
- **WHEN** no tire lines are ready to enter
- **THEN** the page header's Enter action is disabled

#### Scenario: Wheels filter
- **WHEN** Review contains possible wheel lines
- **THEN** the Wheels filter shows their count and selecting it shows their date, invoice, description, quantity, and PDF indicator in the existing table

#### Scenario: Wheels in All
- **WHEN** Review contains possible wheel lines
- **THEN** they remain visible in All and are excluded from the generic Not a tire filter

#### Scenario: Manual wheel guidance
- **WHEN** the Wheels filter is selected
- **THEN** a note tells the person to check whether the wheels qualify for ATD Custom Wheels or ATD Steel Wheels and enter them on ProRewards themselves

### Requirement: Settle a line
Opening a line SHALL show the **Which tire is this?** sheet: the report text, what was read from it (brand, size,
model words), the suggestions with scores and reasons, a search over every tire on the claim page, "Remember
this choice" (on by default), and the actions "Use <tire>" and "Not an eligible tire". Choosing SHALL update the
line, and every other line with the same wording, at once.

#### Scenario: Pick the suggested tire
- **WHEN** the person opens the "NOK ONE" line and clicks Use Nokian One HT
- **THEN** the line becomes Ready with Nokian One HT, and so does every other line with that wording

#### Scenario: Not eligible
- **WHEN** the person clicks Not an eligible tire
- **THEN** the line becomes Not eligible ("you marked this as not eligible")

#### Scenario: Override a ready line
- **WHEN** the person opens a Ready line and picks a different tire
- **THEN** the line uses the tire they picked

### Requirement: Leave a line out
The person SHALL be able to leave any line out of this month's entry, and include it again. Left-out lines are
not entered and do not block Enter. This choice SHALL not be remembered after the sales file is replaced or the
app restarts.

#### Scenario: Leave out a line
- **WHEN** the person leaves out a line that Needs a decision
- **THEN** it shows as Left out, and it no longer keeps Enter disabled

### Requirement: Possible wheels are review-only
The app SHALL label recognized wheel sales Possible wheel without choosing a claim-page wheel product or treating them as eligible. They SHALL NOT block tire entry, count as ready tire sales, enter automatically, upload PDFs automatically, or create saved tire matches.

#### Scenario: Tire entry with a wheel row
- **WHEN** Review contains one ready tire and one possible wheel
- **THEN** Enter shows one sale and the automatic run processes only the tire

#### Scenario: Wheel product choices on the site
- **WHEN** the claim page offers ATD Custom Wheels and ATD Steel Wheels
- **THEN** the app does not pick either product for a possible wheel sale
