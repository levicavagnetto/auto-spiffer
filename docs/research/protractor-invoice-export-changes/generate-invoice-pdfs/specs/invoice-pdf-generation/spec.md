## ADDED Requirements

### Requirement: Match Protractor's invoice
A made invoice PDF SHALL look like the PDF Protractor exports for the same invoice: same page size, margins, fonts,
logo, sections, table columns, line wrapping, totals, footer and page breaks. Every word and number printed SHALL be
the same as Protractor's. Values SHALL be printed as Protractor gives them; the app SHALL NOT recalculate taxes,
discounts, fees or totals.

#### Scenario: Reference invoice
- **WHEN** the app makes a PDF for the reference invoice from its Protractor data
- **THEN** its text matches the reference PDF's text exactly, and each page matches the reference page within the agreed picture tolerance

#### Scenario: Long invoice
- **WHEN** an invoice has more lines than fit on one page
- **THEN** it breaks onto further pages where Protractor's export does, with the same repeated headers and footer

### Requirement: Readable by the app
A made PDF SHALL contain the text "Invoice #" followed by its invoice number, so the app's own PDF reader links it to
the same invoice if the person picks it again later.

#### Scenario: Read back
- **WHEN** the app reads a made PDF with its normal PDF reader
- **THEN** it finds the invoice number the PDF was made for

### Requirement: Missing data is not invented
If the fetched data lacks a value the template needs, the app SHALL NOT make that invoice's PDF. The invoice SHALL
stay on the missing-PDF list with the reason "Could not build this invoice's PDF", and the log SHALL name the missing
field without its value.

#### Scenario: Field missing
- **WHEN** an invoice's data has no totals
- **THEN** no PDF is made for it and it stays on the missing list with that reason

### Requirement: Temporary files
Made PDFs SHALL be written to a temporary Auto Spiffer folder in the person's Windows account, named by invoice
number, and SHALL NOT be written next to the sales export or invoice PDFs the person picked.

#### Scenario: Where files go
- **WHEN** the app makes the PDF for invoice A
- **THEN** it is saved as `A.pdf` in the temporary Auto Spiffer folder
