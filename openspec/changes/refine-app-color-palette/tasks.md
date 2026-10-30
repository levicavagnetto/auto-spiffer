# Tasks

## 1. Theme colors

- [x] 1.1 Update Light and Dark CSS color tokens in `src/renderer/src/globals.css` from the palette in `design.md`; verify the computed workspace, sidebar, header, card, border, text, and primary colors in both themes.
- [x] 1.2 Align any existing color-only component classes with the revised tokens; verify Sales, Review, Enter claims, ProRewards, Saved matches, and Settings show clear surface and state contrast in both themes without layout or behavior changes.
- [x] 1.3 Update the color table and color-use guidance in `docs/ui.md`; verify it matches the implemented token values.

## 2. Integration checks

- [x] 2.1 Check text and control contrast for both themes, including secondary text, active navigation, status pills, tabs, and primary buttons; verify text reaches 4.5:1 and fix color pairs that do not.
- [x] 2.2 Run typecheck, lint, and a build; inspect the diff to verify it contains only color-related app changes and the palette documentation, with no geometry, content, or behavior changes.
- [x] 2.3 Run `openspec validate refine-app-color-palette --strict` and confirm the change is valid.
