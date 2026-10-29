# site-driver Specification

## Purpose
Shows the ProRewards website inside the app and lets the app read and fill the claim page safely.

## Requirements

### Requirement: The site in a tab
The app SHALL show the ProRewards website inside its own window, in a view with its own persistent session,
separate from the app's screens, with no access to the app's code or to Node. It SHALL show the current
address and offer Reload. Links that leave the ProRewards site, and any new window the site opens, SHALL open
in the person's normal browser instead.

#### Scenario: Open the site
- **WHEN** the person opens the ProRewards screen
- **THEN** the ProRewards site loads inside the app and the address bar shows its address

#### Scenario: Leaving the site
- **WHEN** a link on the site points to another website
- **THEN** it opens in the person's normal browser, and the tab stays on ProRewards

#### Scenario: Signed in after a restart
- **WHEN** the person signed in, closed the app and opens it again while the site's login is still valid
- **THEN** the tab opens signed in

### Requirement: Recognize the claim page
The driver SHALL tell whether the tab is showing the claim page (step 3 of Submit Sale) by the presence of the
sale date, invoice, product, quantity, Add, sale list and upload controls.

#### Scenario: Not on the claim page
- **WHEN** the tab shows the Home page
- **THEN** the driver reports that the claim page is not open, and nothing is read or filled

### Requirement: Read the claim page
On the claim page, the driver SHALL read: the promotion name; the program's first and last allowed sale
dates; every Eligible Product label word for word (whitespace squeezed, without "Select One"); and every line
of the Cumulative Sale(s) List as sale date, invoice, product and quantity.

#### Scenario: Tire list
- **WHEN** the driver reads the saved October 2026 claim page
- **THEN** it returns the 77 labels in `docs/reference/tire-list-2026-10.txt`, in order

#### Scenario: Program
- **WHEN** the driver reads the saved October 2026 claim page
- **THEN** it returns the promotion "October 2026 Pro Rewards" and the dates 10/1/2026 to 10/31/2026

#### Scenario: Sale list
- **WHEN** the sale list has two lines
- **THEN** the driver returns both, with dates as dates and quantities as numbers

### Requirement: Add one line
The driver SHALL fill the sale date, invoice number, product (by its exact label) and quantity, confirm the
boxes show exactly that line, click Add, and report one outcome: added, duplicate (answered No), rejected (with
the site's message, dismissed), mismatch (another quantity appeared), or timed out, as defined in
`docs/site-reference.md`. It SHALL work the same when the app window is minimized or hidden.

#### Scenario: Line added
- **WHEN** the driver adds 09/18/2026, invoice 200118, "Nokian Remedy WRG5 - Passenger Tires", qty 4
- **THEN** the outcome is added and the sale list has that line

#### Scenario: Duplicate warning
- **WHEN** the site shows its duplicate warning after Add
- **THEN** the driver clicks No, never Yes, and reports duplicate

#### Scenario: Site rejects the line
- **WHEN** the site shows a validation message after Add
- **THEN** the driver reports rejected with the message's text and closes it

#### Scenario: Window minimized
- **WHEN** the app window is minimized and the driver adds a line
- **THEN** the line is added in about the same time as when the window is in front

#### Scenario: Tire not in the list
- **WHEN** the driver is asked to add a product label the dropdown does not have
- **THEN** nothing is clicked and it reports that the tire is not on the claim page

### Requirement: Upload one PDF
The driver SHALL attach a PDF file to the claim page's upload control and report success once the site shows
the upload finished, or failure after 90 seconds. It SHALL open no network port to do so.

#### Scenario: Upload
- **WHEN** the driver uploads an invoice PDF
- **THEN** the site's uploaded files list grows by one and the driver reports success

### Requirement: Never submit
Every click the driver makes SHALL go through one check that refuses the never-click list in
`docs/site-reference.md` and any element labeled Next or Submit on the claim page. A refused click SHALL be an
error, logged, and never retried.

#### Scenario: Asked to click Next
- **WHEN** any code asks the driver to click the claim page's Next
- **THEN** the click is refused with an error, and the site receives no click

### Requirement: Failure pictures
When asked, the driver SHALL save a picture of the tab to the logs folder, named with the time and the invoice.

#### Scenario: Picture of a failed line
- **WHEN** a line fails and a picture is requested
- **THEN** a PNG of the tab is saved in the logs folder
