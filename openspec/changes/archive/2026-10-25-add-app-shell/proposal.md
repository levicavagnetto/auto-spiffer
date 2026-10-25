# 01 · App shell

## Why

Every later change needs a running Electron app to live in: the window, the sidebar, the screens' frames, the
theme, a safe bridge between the screens and the main process, saved settings and logging. Building it first,
with the security settings right from the start, keeps later changes small.

## What Changes

- A new Electron + electron-vite + React + TypeScript project at the repo root, with Tailwind v4 and shadcn/ui.
- The window with the sidebar and four empty screens (Sales, Review, Enter claims, Settings) plus the
  ProRewards item, laid out as in `docs/ui.md`, with the logo.
- Light and dark themes from the color tokens in `docs/ui.md`, following Windows by default.
- A typed, validated IPC bridge (preload + Zod) as the only way the screens reach the main process.
- Settings storage (electron-store) with the theme and window size, and logging to the app data folder.
- A single-instance lock.
- Lint, format, typecheck, Vitest and a Playwright `_electron` smoke test, all run by one `npm run check`.

## Capabilities

### New Capabilities
- `app-shell`: the window, navigation, themes, the IPC boundary, settings storage, logging and the
  single-instance rule.

### Modified Capabilities
- None.

## Impact

- New: `package.json`, `electron.vite.config.ts`, `src/main`, `src/preload`, `src/renderer`, `tests/`.
- No site, file reading or matching yet. Screens show placeholders.
- Depends on nothing. Every later change depends on this one.
