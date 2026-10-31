## ADDED Requirements

### Requirement: Missing PDFs remain visible after rerun

The finished Enter claims panel SHALL show invoices for ready sales without linked PDFs, even when a rerun finds those sales already on the claim page.

#### Scenario: Rerun skips an entered sale

- **GIVEN** a ready sale has no linked PDF
- **WHEN** Check page and run again finds that sale already on the claim page
- **THEN** its invoice remains in PDFs needing upload

#### Scenario: One invoice appears in multiple sources

- **WHEN** an invoice has no linked PDF and also appears in the run's missing-PDF result
- **THEN** the panel lists that invoice once
