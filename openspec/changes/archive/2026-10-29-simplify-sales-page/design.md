# Design

## Context

`Sales.tsx` currently renders the loaded state as a two-column grid. The left column contains the export and PDF cards; the right column contains ProRewards status/navigation and a Ready to match summary. The primary Match tires button already lives in the shared page header. The sidebar already has a ProRewards item and sign-in state.

## Goals / Non-Goals

**Goals:** Remove only the two marked Sales cards, use the freed width for the remaining cards, and keep the route to the website and the match action easy to find.

**Non-Goals:** Change the sidebar, Review screen, matching rules, PDF linking, or warnings.

## Decisions

### Single content column

Replace the loaded Sales grid with a vertical stack of the Material Sales export and Invoice PDFs cards. Both cards use the content area width, including at the 1100 px minimum window size. Keeping the old left-column width would leave the empty right side shown in the screenshot.

### Remove card-only wiring

Remove Sales props and helpers used only by the ProRewards and Ready to match cards. Keep ProRewards navigation in the sidebar and Match tires in the header. No new navigation control replaces the removed Show website button because the sidebar already provides that action.

## Risks / Trade-offs

- Full-width PDF warnings may produce long lines. Verify readability and wrapping at the default and minimum window widths.
- Existing tests that use the Sales card's sign-in text or Show website button need to use the sidebar state or navigation instead; keep their behavior checks intact.
