## MODIFIED Requirements

### Requirement: Link sales to PDFs
Each sale SHALL be linked to the PDF for its invoice number, whether the person picked it or the app made it from Protractor. A PDF the person picked SHALL be used over a made one for the same invoice, and the made one SHALL then be dropped. The Sales screen SHALL report how many PDFs were loaded and linked, mark made PDFs **From Protractor**, show a compact count of tire sales that have no PDF (they are still entered later), list PDFs whose invoice is not in the month's sales (they are ignored), and list invoices with more than one picked PDF (the first is used). The missing-invoice count SHALL be expandable into a bounded list of invoice numbers, each shown with the reason the app could not get it from Protractor when it tried. Each number SHALL be individually copyable. The screen SHALL tell the person whether copying succeeded or failed. While the app is getting invoices from Protractor, the Sales screen SHALL show how many it is getting and how many are done, and SHALL stay usable.

#### Scenario: Sales without a PDF
- **WHEN** two tire sales have no matching PDF
- **THEN** the Sales screen shows that two invoices need PDFs, with their numbers available in the expandable list, and says the sales will still be entered

#### Scenario: Extra PDF
- **WHEN** a PDF's invoice is not in the month's sales
- **THEN** it is listed as not in this month's sales, and ignored

#### Scenario: No PDFs at all
- **WHEN** the person loads no PDFs and no Protractor login is saved
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

#### Scenario: Made from Protractor
- **WHEN** the app makes the PDF for invoice A
- **THEN** A leaves the missing list and its PDF appears in the Invoice PDFs section marked From Protractor

#### Scenario: Person picks a PDF for a made invoice
- **WHEN** the person adds their own PDF for invoice A after the app made one
- **THEN** the person's PDF is linked and the made one is removed

#### Scenario: Could not get an invoice
- **WHEN** invoice B was not found in Protractor
- **THEN** B stays in the missing list with the reason "Not found in Protractor"

#### Scenario: Progress
- **WHEN** the app is getting 12 invoices and 5 are done
- **THEN** the Invoice PDFs section says "Getting 12 invoices from Protractor, 5 done" and Match tires stays available
