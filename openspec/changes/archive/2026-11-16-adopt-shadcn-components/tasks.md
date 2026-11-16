## 1. Components

- [x] 1.1 Add Base UI shadcn components: input, label, checkbox, radio-group, select, tabs, table, card, badge, alert, sheet, collapsible, separator (native overflow scrolling kept; see design)
- [x] 1.2 Add `sonner` and the shadcn `sonner` component; mount one `<Toaster>` in `App.tsx`
- [x] 1.3 Add a `warning` variant to Alert and Badge using the existing warning tokens
- [x] 1.4 `npm run typecheck` and `npm test` pass with no screen changes yet

## 2. Settings

- [x] 2.1 Convert cards, inputs, labels, checkboxes, radios and buttons in `Settings.tsx` (including the saved-matches list)
- [x] 2.2 Update `settings-updates-screen.test.tsx`, `credentials-card.spec.ts`, `stay-signed-in.spec.ts`; tests pass

## 3. Sales and Missing invoice PDFs

- [x] 3.1 Convert `Sales.tsx` cards, alerts and file list; keep the hidden file inputs
- [x] 3.2 Convert `MissingInvoicePdfs.tsx` to Alert `warning`
- [x] 3.3 Update `sales-screen.spec.ts`; tests pass

## 4. Review

- [x] 4.1 Convert the tab strip to Tabs, search to Input, list to Table, chips to Badge, alerts to Alert
- [x] 4.2 Convert the matching drawer to Sheet with RadioGroup and Checkbox; Esc closes and focus returns
- [x] 4.3 Keep quiet scrolling on Review
- [x] 4.4 Update `review-screen.test.tsx` and `matching-review.spec.ts`; add a test for Esc closing the drawer; tests pass

## 5. Enter claims

- [x] 5.1 Convert Activity and PDFs-needing-upload sections to Collapsible, panels to Card, pills to Badge, alerts to Alert, icon buttons to Button
- [x] 5.2 Keep quiet scrolling on Enter claims
- [x] 5.3 Enter-claims e2e tests pass

## 6. Live check, ProRewards, Sidebar, App

- [x] 6.1 Convert `LiveCheck.tsx` (Collapsible, Input, Label, Select, Button)
- [x] 6.2 Convert `ProRewards.tsx` (Button, Badge, Card)
- [x] 6.3 Convert `Sidebar.tsx` (Button ghost, Card) keeping `aria-current` styling
- [x] 6.4 Show `ErrorToast` through Sonner (`toast.custom`, keeping the alert role); convert the App error banner to Alert
- [x] 6.5 Update `screens.spec.ts`; tests pass

## 7. Finish

- [x] 7.1 Grep `src/renderer` for raw `<input`, `<select`, `<textarea`, `<table`, `<details`, `<button`; only hidden file inputs remain
- [x] 7.2 Update the component list in `docs/ui.md`
- [x] 7.3 Check every screen in the running app in light and dark mode
- [x] 7.4 `openspec validate adopt-shadcn-components --strict`, `npm test`, `npm run test:e2e` pass
