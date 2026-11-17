## ADDED Requirements

### Requirement: Enter approved wheels like tires

A Ready line whose product is a wheel product SHALL be entered with the same steps, checks and duplicate guard as a tire line: choose that product in Eligible Product, use the line's date, invoice and quantity, and upload the invoice's PDF once.

#### Scenario: Wheel line entered

- **WHEN** a run includes a Ready line for invoice 900123 with "ATD Custom Wheels", quantity 4
- **THEN** the app picks ATD Custom Wheels, enters quantity 4 for invoice 900123, checks that the line appeared, and uploads that invoice's PDF

#### Scenario: Wheel already on the page

- **WHEN** the Cumulative Sale(s) List already has that invoice with ATD Custom Wheels
- **THEN** the line is skipped as already on the page
