# Proposal

## Why

The Enter Claims left panel changes its layout completely after a run. During entry, routine missing-PDF messages crowd the activity feed; afterward, a long invoice list takes over the panel. This makes progress and next steps harder to scan.

## What Changes

- Keep the same progress header, information card, controls, detail sections, and reminder before, during, and after a run.
- Group routine missing-PDF events under a count rather than showing one activity card per invoice.
- Make Activity and PDFs needing upload expandable, with copyable invoice numbers.
- Preserve page-check details, failed-sale reasons and pictures, upload failures, and the rerun action.

## Capabilities

### Modified Capabilities

- `claim-entry`: Enter Claims panel presentation and details.

## Impact

Renderer layout and focused screen tests. Run behavior, storage, and site automation do not change.
