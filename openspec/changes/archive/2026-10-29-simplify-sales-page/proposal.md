# Proposal

## Why

After Match tires moved into the Sales header, the ProRewards and Ready to match cards repeat information and actions available elsewhere. They leave a large, mostly empty right column beside the export and PDF cards.

## What Changes

- Remove the ProRewards and Ready to match cards from the Sales screen.
- Let Material Sales export and Invoice PDFs use the available content width in a single column.
- Keep Match tires in the page header and ProRewards navigation in the sidebar. Keep all existing import, PDF, warning, and matching behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `sales-import`: The loaded Sales screen uses one content column containing the export and PDF sections, without the two right-side cards.

## Impact

Sales renderer layout and props, its App wiring, the Sales section of `docs/ui.md`, and Sales screen tests. No data format or site behavior changes.
