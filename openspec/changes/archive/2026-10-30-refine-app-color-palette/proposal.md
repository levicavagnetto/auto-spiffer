# Proposal

## Why

The current light and dark themes use surfaces that are too close in color, making the app feel flat. The approved Review mockups show clearer separation between the workspace, navigation, cards, and data while retaining Auto Spiffer's blue identity.

## What Changes

- Update the light and dark theme color tokens to follow the approved contrast mockups in `private-data/mockups/review-light-contrast-concept.html` and `private-data/mockups/review-contrast-concept.html`.
- Apply the revised colors consistently across the existing app screens, including navigation, headers, cards, tables, controls, text, and semantic status colors.
- Update the palette reference in `docs/ui.md` and verify readable contrast in both themes.
- Preserve all layout, spacing, sizing, typography, borders, corner radii, shadows, icons, copy, and behavior. The mockups are color references, not instructions to add their sample metrics or change component structure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-shell`: Change the theme token palette and require the same palette across existing screens while retaining Light, Dark, and Same as Windows behavior.

## Impact

The renderer theme definitions in `src/renderer/src/globals.css`, any existing color-only component classes that need token alignment, and `docs/ui.md`. No IPC, storage, site automation, dependencies, or claim-entry behavior changes.
