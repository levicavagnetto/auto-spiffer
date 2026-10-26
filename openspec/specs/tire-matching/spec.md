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
The Review screen SHALL list every line (tire lines and Not a tire rows) with status, sale date, invoice, the
report's description, the claim page tire (or the guess, or why not), quantity and whether it has a PDF, as in
`docs/ui.md`. It SHALL filter by status with counts, search by invoice or tire, and summarize ready lines and
tires. The **Enter N sales** action SHALL stay disabled, with the reason shown, while any line Needs a decision.

#### Scenario: Lines needing a decision
- **WHEN** two lines Need a decision
- **THEN** Enter is disabled and the screen says "Decide 2 tires to continue"

#### Scenario: All decided
- **WHEN** the person settles the last line that needed a decision
- **THEN** Enter shows the number of ready lines and becomes available

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
