## MODIFIED Requirements

### Requirement: Link sales to PDFs
Each sale SHALL be linked to the PDF for its invoice number. The Sales screen SHALL report how many PDFs were loaded and linked, show a compact count of tire sales that have no PDF (they are still entered later), list PDFs whose invoice is not in the month's sales (they are ignored), and list invoices with more than one PDF (the first is used). The missing-invoice count SHALL be expandable into a bounded list of invoice numbers. Each number SHALL be individually copyable. The screen SHALL tell the person whether copying succeeded or failed.

#### Scenario: Sales without a PDF
- **WHEN** two tire sales have no matching PDF
- **THEN** the Sales screen shows that two invoices need PDFs, with their numbers available in the expandable list, and says the sales will still be entered

#### Scenario: Extra PDF
- **WHEN** a PDF's invoice is not in the month's sales
- **THEN** it is listed as not in this month's sales, and ignored

#### Scenario: No PDFs at all
- **WHEN** the person loads no PDFs
- **THEN** the app continues, and says the PDFs can be added here or uploaded on ProRewards

#### Scenario: Missing invoice PDFs
- **WHEN** some tire sales have no linked PDF
- **THEN** the Sales screen shows the missing count and says those sales will still be entered and their PDFs can be added here or uploaded on ProRewards
- **AND** the invoice numbers are initially hidden

#### Scenario: Copy one invoice number
- **WHEN** the person expands the missing-invoice list and clicks an invoice number
- **THEN** only that number is copied to the clipboard and the screen confirms it

#### Scenario: PDF added for a missing invoice
- **WHEN** a PDF is linked to an invoice previously in the missing list
- **THEN** that invoice disappears from the list and the count updates
