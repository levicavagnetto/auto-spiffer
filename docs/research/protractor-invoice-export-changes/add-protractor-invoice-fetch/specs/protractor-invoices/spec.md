## ADDED Requirements

### Requirement: Fetch missing invoices in the background
After a Material Sales export is read, if a Protractor login is saved, the app SHALL fetch the invoice data from
Protractor for each tire-sale invoice that has no linked PDF at that moment. It SHALL fetch each invoice number once
per export. It SHALL NOT fetch invoices that already have a linked PDF, invoices that have only wheel or non-tire
rows, or invoices outside the export. The Sales screen SHALL stay usable while fetching.

#### Scenario: Some PDFs already picked
- **WHEN** an export has tire sales on invoices A, B and C and the person already linked a PDF for B
- **THEN** the app fetches A and C only

#### Scenario: Same invoice on several lines
- **WHEN** invoice A has three tire lines
- **THEN** invoice A is fetched once

#### Scenario: PDF added while fetching
- **WHEN** the person links a PDF for invoice C before its fetch starts
- **THEN** C is not fetched

#### Scenario: No login saved
- **WHEN** no Protractor login is saved
- **THEN** nothing is fetched and Protractor is not contacted

### Requirement: Sign in to Protractor once per export
The app SHALL sign in to Protractor with the saved login when fetching starts, and SHALL NOT retry a refused login
by itself. A refused login SHALL stop fetching for this export and set the Protractor login state to "not
accepted". If Protractor cannot be reached, the state SHALL be "could not reach Protractor".

#### Scenario: Wrong password
- **WHEN** Protractor refuses the saved login
- **THEN** no invoices are fetched, every missing invoice keeps the reason "Protractor login not accepted", and the login is tried again only after the person saves it again or loads an export again

### Requirement: Read only
The app SHALL send Protractor only the requests needed to sign in, look up an invoice by number, read its details
and end the session. Any other request, including any that creates or removes a lock or saves data, SHALL be refused
by the app before it is sent and logged as an error.

#### Scenario: A blocked request
- **WHEN** code asks the Protractor client to send a request that is not on the allowed list
- **THEN** the request is not sent and an error is logged

### Requirement: Pace, retry and cancel
The app SHALL send at most a few requests at a time to Protractor, wait between them, and retry a failed lookup at
most twice before marking that invoice failed. Picking a new export, removing the export, or closing the app SHALL
cancel fetching; results that arrive after a cancel SHALL be ignored.

#### Scenario: One invoice fails
- **WHEN** the lookup for invoice A fails three times
- **THEN** A is marked "Could not get this invoice from Protractor" and the other invoices are still fetched

#### Scenario: Export replaced
- **WHEN** the person picks a different export while fetching
- **THEN** fetching for the old export stops and none of its results are used

### Requirement: Invoice not found
An invoice number that Protractor does not find SHALL be marked "Not found in Protractor". If Protractor returns
more than one invoice for the number, the app SHALL use none of them and mark it "More than one invoice in
Protractor has this number".

#### Scenario: Not found
- **WHEN** Protractor has no invoice with number A
- **THEN** A stays on the missing-PDF list with the reason "Not found in Protractor"

### Requirement: Nothing kept
Fetched invoice data SHALL be held in memory for the current export only. It SHALL NOT be written to disk, sent to
the screens beyond what change 12 displays, or written to the log; the log records only invoice counts, outcomes
and technical errors without customer data or credentials.

#### Scenario: After restart
- **WHEN** the person closes and reopens the app and loads the same export
- **THEN** the invoices are fetched again
