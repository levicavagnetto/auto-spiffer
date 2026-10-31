# Spec Delta

## MODIFIED Requirements

### Requirement: Themes
The app SHALL offer Light, Dark and "Same as Windows" themes, default "Same as Windows", using the revised color tokens in `docs/ui.md`. Both themes SHALL give the sidebar, workspace, headers, cards, tables, controls, and status messages clearly distinguishable colors consistent with the approved Review mockups. The choice SHALL be remembered. Text SHALL meet a 4.5:1 contrast ratio in both themes. Theme changes SHALL NOT alter component layout, geometry, typography, copy, or behavior.

#### Scenario: Follows Windows
- **WHEN** the theme is "Same as Windows" and Windows switches to dark mode
- **THEN** the app switches to the dark theme without a restart

#### Scenario: Chosen theme kept
- **WHEN** the person picks Dark and restarts the app
- **THEN** the app opens in the dark theme

#### Scenario: Colors are consistent across screens
- **WHEN** the person navigates among Sales, Review, Enter claims, ProRewards, Saved matches, and Settings in either theme
- **THEN** existing app surfaces and controls use the corresponding revised palette, with readable text and visible state differences

#### Scenario: Existing interface structure is preserved
- **WHEN** the revised palette is applied
- **THEN** each screen keeps its existing elements, positions, sizes, spacing, shapes, typography, copy, and interactions
