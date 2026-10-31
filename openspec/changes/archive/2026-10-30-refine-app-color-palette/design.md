# Design

## Context

The renderer uses theme variables in `src/renderer/src/globals.css`; screens and shared components mostly consume them through Tailwind token classes. The existing `app-shell` theme spec requires Light, Dark, and Same as Windows, persistence, and readable text. See `proposal.md` for the visual goal.

## Goals / Non-Goals

**Goals:** Establish clear color separation between the app's navigation, workspace, header, content surfaces, table rows, controls, and statuses in both themes. Keep the existing theme mechanism and centralized token use.

**Non-Goals:** Rebuild the Review mockup; add its sample metric cards; change any component structure, dimensions, spacing, border width, radius, shadow, icon, font, wording, or interaction. Do not recolor the embedded ProRewards website, which is third-party content.

## Decisions

### Use the approved mockups as color references only

The dark mockup is `private-data/mockups/review-contrast-concept.html`; the light mockup is `private-data/mockups/review-light-contrast-concept.html`. They are gitignored and include sample content, so this design records the palette needed by another checkout. Key reference surfaces:

| Surface | Light | Dark |
|---|---|---|
| Workspace | `#EEF3F9` | `#0B1428` |
| Sidebar | `#E3EBF5` | `#101D38` |
| Header | `#FFFFFF` | `#101B34` |
| Card / table | `#FFFFFF` | `#14223E` |
| Subtle control fill | `#DCE7F4` | `#172746` |
| Table header | `#DCE7F4` | `#24385C` |
| Divider / outline | `#C5D4E6` | `#3A5383` |
| Primary action | `#245B9A` with white text | `#67B6FF` with dark text |
| Main text | `#182842` | `#F5F8FF` |
| Secondary text | `#516784` | `#AAB9D7` |

Other semantic colors use the mockup's corresponding blue, green, and violet tones where applicable. Exact pairs must pass the contrast requirement. If a mockup pair does not, adjust that pair toward greater contrast while retaining the same visual direction.

### Extend tokens only where existing roles differ

Change the existing theme variables first. Add narrowly named semantic CSS variables only where one existing token cannot represent two distinct surfaces (for example, header versus card, or table header versus subtle control fill). Use those variables via Tailwind theme aliases or existing CSS selectors. This avoids literal color values in screen components and preserves the current theme switching behavior. The alternative of scattering hex colors through JSX would make Light and Dark diverge.

### Keep the change color-only

The implementation may edit CSS variable values and color-related classes or declarations. It must not edit layout or shape classes. Existing data and actions stay intact. Update `docs/ui.md` to make the shipped palette authoritative; the private mockups remain visual references, not runtime assets.

## Risks / Trade-offs

- Some current text/background combinations may fail 4.5:1 after token substitution → check computed combinations, especially muted text, active tabs, button labels, and status pills, then adjust colors only.
- A shared token may color an unexpected screen or state → inspect all six screens in both themes and fix color roles through tokens.
- The mockup uses sample content and visual treatments outside the color scope → compare palette and separation only; preserve the implemented UI structure.

## Migration Plan

No data migration. Theme preferences continue to select the same Light, Dark, or Same as Windows values. Reverting the color changes restores the previous palette.
