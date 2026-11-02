## ADDED Requirements

### Requirement: Delete made PDFs after upload
After the app confirms that a PDF it made from Protractor was uploaded to the claim, it SHALL delete that file. A
made PDF that was not uploaded, or whose upload failed, SHALL be kept until the export is replaced, the export is
removed, or the app closes, and SHALL then be deleted. When the app starts it SHALL delete any made PDFs left from
earlier sessions. The app SHALL NEVER delete a PDF the person picked, and SHALL only delete files inside its own
temporary folder.

#### Scenario: Uploaded
- **WHEN** the made PDF for invoice A is uploaded and the claim page shows it
- **THEN** the file is deleted and invoice A is shown as Uploaded

#### Scenario: Upload failed
- **WHEN** the upload of the made PDF for invoice B fails
- **THEN** the file is kept, B is listed under PDFs needing upload, and a rerun can still upload it

#### Scenario: Person's own PDF
- **WHEN** the PDF the person picked for invoice C is uploaded
- **THEN** the file is not deleted

#### Scenario: Left over after a crash
- **WHEN** the app starts and made PDFs from an earlier session are still in its temporary folder
- **THEN** they are deleted

#### Scenario: Export replaced
- **WHEN** the person picks a different export
- **THEN** made PDFs for the old export are deleted

### Requirement: Uploaded made PDFs on rerun
An invoice whose made PDF was uploaded and deleted SHALL NOT be shown as missing a PDF, and a rerun SHALL NOT try to
upload it again. If a rerun adds a new line for that invoice, the app SHALL make the PDF again from Protractor before
uploading it.

#### Scenario: Rerun after upload
- **WHEN** the person runs Check page and run again and all of invoice A's lines are already on the page
- **THEN** A is not uploaded again and is not listed as needing a PDF

#### Scenario: New line on a rerun
- **WHEN** a rerun adds a line for invoice A whose made PDF was already deleted
- **THEN** the app makes A's PDF again and uploads it once
