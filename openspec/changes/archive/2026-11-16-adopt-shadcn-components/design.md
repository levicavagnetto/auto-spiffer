# Design

## Context

The renderer already follows shadcn conventions (`components.json`, new-york style, Tailwind v4 tokens in
`globals.css`, `cn()` in `lib/utils`), and the two installed components use **Base UI** (`@base-ui/react`) rather
than Radix. Everything else is hand-built. The audit (by screen) found:

| File | Hand-built | Becomes |
|---|---|---|
| `screens/Settings.tsx` | buttons, text/password inputs, checkboxes, radios, cards, search box | Button, Input, Label, Checkbox/Switch, RadioGroup, Card |
| `screens/Review.tsx` | tab strip, search, table, side drawer, radio lists, checkbox, chips, alerts | Tabs, Input, Table, Sheet, RadioGroup, Checkbox, Badge, Alert |
| `screens/EnterClaims.tsx` | expandable sections, icon buttons, count pills, alerts, panels | Collapsible, Button, Badge, Alert, Card |
| `screens/LiveCheck.tsx` | `<details>`, inputs, `<select>`, buttons | Collapsible, Input, Label, Select, Button |
| `screens/Sales.tsx` | cards, alerts, file list | Card, Alert (file inputs stay) |
| `screens/ProRewards.tsx` | icon/small buttons, status pill, frame | Button, Badge, Card |
| `screens/MissingInvoicePdfs.tsx` | warning panel | Alert (warning) |
| `components/Sidebar.tsx` | nav buttons, status card | Button (ghost), Card |
| `components/ErrorToast.tsx` | custom toast | Sonner (`toast.custom` wrapper) |
| `App.tsx` | error banner | Alert (destructive) |

## Goals / Non-Goals

**Goals:** one consistent component set; same text, layout and flow; better keyboard and focus behavior.

**Non-Goals:** redesigning screens, changing wording, changing site-driving code, replacing the Sidebar with the full
shadcn `Sidebar` block (too heavy for a fixed 248 px nav; Button + Card is enough).

## Decisions

- **Base UI flavor.** Add components with `npx shadcn@latest add <name>` using the Base UI registry so they match the
  existing Progress. If the CLI cannot target Base UI for one component, write it by hand from the shadcn Base UI
  source; do not mix in Radix.
- **Warning variant.** Extend Alert's and Badge's `cva` with `warning` using existing `bg-warning` /
  `text-warning-foreground` tokens. No new colors.
- **Checkbox vs Switch.** Settings toggles that turn a behavior on or off ("Stay signed in", "Check for updates")
  stay Checkbox to keep their `checkbox` role and current tests; Switch is added only if a reviewer prefers it later.
- **Sheet for the Review drawer.** It brings focus trapping, Esc, and focus return. Keep the 440 px width and
  right-side placement; it still has role `dialog` with the same accessible name.
- **Sonner for errors.** Mount one `<Toaster>` in `App.tsx`. `ErrorToast.tsx` stays as a small wrapper that shows the
  message with `toast.custom` while it is mounted, so the toast keeps its `alert` role, its Dismiss button and the
  7 second timeout. Its callers did not change.
- **File inputs stay native** and hidden; Buttons trigger them as today.
- **No ScrollArea.** Review and Enter claims hide scrollbars with the global `hide-app-scrollbars` class on the page
  itself, so a ScrollArea would add nothing. It was left out.

## Risks / Trade-offs

- Base UI Checkbox/Radio render a `button` with `role="checkbox"`/`"radio"` plus a hidden input. Playwright
  `.check()` and Testing Library `getByRole` still work, but tests that use `fireEvent.change` on the input need to
  switch to `click`. → Fix per screen as each is converted.
- Base UI Select is not a native `<select>`; tests using `selectOption` must open and click an option. → Only
  LiveCheck uses it.
- Sheet moves the drawer into a portal; tests scoped to the screen container may not find it. → Query from the
  page / `screen`, not the container.
