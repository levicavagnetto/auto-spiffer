# Proposal

## Why

`docs/ui.md` says the app is built from shadcn/ui components, but only `Button` and `Progress` are installed. An audit
found about 60 hand-built controls (raw `<input>`, `<select>`, `<details>`, `<table>`, a custom drawer, a custom
toast, hand-styled cards and warning boxes) across every screen. They look slightly different from screen to screen,
and several miss keyboard and focus behavior that shadcn gives for free (the Review drawer has no focus trap or Esc).

## What Changes

- Add the shadcn components the screens need, in the project's existing Base UI flavor (`@base-ui/react`):
  Input, Label, Checkbox, Switch, RadioGroup, Select, Tabs, Table, Card, Badge, Alert, Sheet, Collapsible,
  Separator, Sonner (toast).
- Add a `warning` variant to Alert (and Badge) that uses the theme's `warning` tokens, so warning boxes keep their look.
- Convert each screen, one at a time: Settings, Sales, Review, Enter claims, Live check, ProRewards,
  Missing invoice PDFs, the Sidebar, the error toast and the App error banner.
- Review's matching drawer becomes a Sheet (focus trap, Esc closes, focus returns to the row).
- The error toast becomes Sonner.
- Hidden `<input type="file">` pickers stay native (shadcn has no file picker; visible Buttons already open them).
- Update unit and end-to-end tests whose selectors depend on the old elements.

No wording, layout, flow, or site behavior changes. The never-click list and all hard rules are untouched.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-ui`: adds a requirement that renderer controls come from the shared shadcn component set, keep their
  accessible roles and names, and support keyboard use.

## Impact

- Code: `src/renderer/src/components/ui/*` (new), every file in `src/renderer/src/screens/`, `Sidebar.tsx`,
  `ErrorToast.tsx`, `App.tsx`, `globals.css` (warning tokens already exist).
- Dependencies: `sonner` (new). Base UI is already installed.
- Tests: `tests/unit/review-screen.test.tsx`, `tests/unit/settings-updates-screen.test.tsx`, and e2e specs in
  `tests/e2e/` that use checkbox, radio, tab, dialog, textbox and alert roles.
- Docs: `docs/ui.md` component list.
