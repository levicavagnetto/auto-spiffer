# Proposal

## Why

After Check page and run again, sales already on the claim page do not produce new missing-PDF events. The Enter claims panel therefore incorrectly shows zero PDFs needing upload.

## What Changes

- Keep showing every ready sale without a linked invoice PDF in the finished panel, including after a rerun.
- Continue showing upload failures and deduplicate invoice numbers.

## Capabilities

### Modified Capabilities

- `claim-entry`: Finished run PDF guidance.
