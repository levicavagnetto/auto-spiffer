# sales-import Specification

## Purpose
Turns the month's Material Sales export and invoice PDFs into a checked list of sales, each linked to its PDF
when there is one.

## Requirements

### Requirement: Read the Material Sales export
The app SHALL read an `.xlsx` Material Sales export by its column headings (Invoiced, Invoice #, Description,
Quantity, in any column order, matched case-insensitively), ignoring every other column including Supplier.
Each data row SHALL become a sale with its date (the date part of Invoiced), invoice number (as text, no
decimals), description (whitespace squeezed) and quantity (a whole number). Empty rows SHALL be skipped.

#### Scenario: A normal export
- **WHEN** the person picks an export with 49 data rows
- **THEN** the app reads 49 sales, with dates, invoice numbers, descriptions and quantities as in the file

#### Scenario: Missing column
- **WHEN** the file has no Quantity heading
- **THEN** the app says "This file does not look like a Material Sales export: the Quantity column is missing." and reads nothing

#### Scenario: Unreadable row
- **WHEN** a row's quantity is not a whole number or its date is missing
- **THEN** that row is skipped, and the Sales screen lists it as unreadable with its row number

#### Scenario: Not an Excel file
- **WHEN** the person picks a file that is not a readable `.xlsx`
- **THEN** the app says it could not read the file as an Excel workbook

### Requirement: Rows that are not tires
A sale whose description contains "shipping" or "handling", or the word "tube", or no tire size (as defined in
`docs/matching.md`) SHALL be marked "Not a tire", kept for display, and never matched or entered.

#### Scenario: Shipping row
- **WHEN** a row's description is "Shipping and Handling"
- **THEN** it is marked Not a tire

#### Scenario: Tube
- **WHEN** a row's description is "18X8.50/9.50-8 FST IMPORT TR13 TUBE 18X850/950-8"
- **THEN** it is marked Not a tire

### Requirement: The month
The month SHALL be the calendar month of the sale dates. When the sales span more than one month, the app SHALL
say so, name the months and their row counts, and use the month with the most tire rows.

#### Scenario: One month
- **WHEN** every sale is in September 2026
- **THEN** the month is September 2026 and the sidebar shows "September 2026"

#### Scenario: Two months
- **WHEN** 40 tire rows are in September and 2 in October
- **THEN** the app warns that the file has sales from September (40) and October (2), and uses September

### Requirement: Read invoice PDFs
The app SHALL read each picked or dropped PDF (or every PDF in a picked or dropped folder, not recursive) and
find its invoice number: the number that appears most often after "Invoice #" in the PDF's text; if none, a 5
to 7 digit number in the file name. File names SHALL otherwise not matter. Reading SHALL not freeze the window.

#### Scenario: Number inside the PDF
- **WHEN** a PDF named "scan 12.pdf" contains "Invoice # 200118"
- **THEN** it is the PDF for invoice 200118

#### Scenario: PDF and file name disagree
- **WHEN** a PDF named "200999.pdf" contains "Invoice # 200118"
- **THEN** it is the PDF for 200118, with a note that the file name says 200999

#### Scenario: No number anywhere
- **WHEN** a PDF has no "Invoice #" text and no number in its name
- **THEN** it is listed as "No invoice number found" and not linked

#### Scenario: Not a PDF
- **WHEN** a dropped file cannot be read as a PDF
- **THEN** it is listed as unreadable with its name, and the others are still read

### Requirement: Link sales to PDFs
Each sale SHALL be linked to the PDF for its invoice number. The Sales screen SHALL report how many PDFs were
loaded and linked, list the tire sales that have no PDF (they are still entered later), list PDFs whose invoice
is not in the month's sales (they are ignored), and list invoices with more than one PDF (the first is used).

#### Scenario: Sales without a PDF
- **WHEN** two tire sales have no matching PDF
- **THEN** the Sales screen lists their invoice numbers and says they will still be entered and their PDFs must be uploaded on the website

#### Scenario: Extra PDF
- **WHEN** a PDF's invoice is not in the month's sales
- **THEN** it is listed as not in this month's sales, and ignored

#### Scenario: No PDFs at all
- **WHEN** the person loads no PDFs
- **THEN** the app continues, and says the PDFs must be uploaded on the website

### Requirement: Sales screen
The Sales screen SHALL show the export (file name, date range, rows, tire lines, rows left out and why), the
invoice PDFs summary and warnings, and a **Match tires** action at the right of the page header. The action
SHALL be disabled until an export is read and SHALL remain available after an export is read. Picking a new
export SHALL replace the old one; adding PDFs SHALL add to those already loaded, and the person SHALL be
able to remove them.

#### Scenario: Replace the export
- **WHEN** the person picks a different export
- **THEN** the screen shows the new file's figures and any earlier review decisions for the old file are dropped

#### Scenario: No export loaded
- **WHEN** the Sales screen has no export
- **THEN** Match tires appears in the page header, disabled

#### Scenario: Export loaded
- **WHEN** an export is read
- **THEN** Match tires appears in the page header, enabled unless matching is already in progress
