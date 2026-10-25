# Design

## Context

See `proposal.md`, `docs/architecture.md` (process layout, security boundaries, storage) and `docs/ui.md`
(screens, tokens, logo). This is the first change; the repo has only docs and OpenSpec.

## Goals / Non-Goals

**Goals:** a secure, typed skeleton every later change plugs into; one command that proves it works.

**Non-Goals:** reading files, the site, matching, packaging (later changes).

## Decisions

### D1. Project layout
```
src/main/         Electron main process (index.ts, ipc.ts, settings.ts, log.ts, window.ts)
src/preload/      contextBridge API (index.ts) - no logic
src/renderer/     React app (main.tsx, App.tsx, screens/, components/ui/ from shadcn, lib/)
src/shared/       types and Zod schemas shared by main and renderer (ipc contract)
tests/unit/       Vitest
tests/e2e/        Playwright _electron
```
electron-vite builds the three targets. TypeScript `strict`, `noUncheckedIndexedAccess`.

### D2. IPC contract
`src/shared/ipc.ts` defines every call as `{ name, input: ZodSchema, output: ZodSchema }`. The preload exposes
`window.api.<name>(input)` built from that list (invoke/handle) and one `window.api.on(event, cb)` for events
from main (progress, log lines), also from a fixed list. The main process registers handlers from the same
list and parses input with Zod before running anything. Renderer types come from the schemas, so both sides
cannot drift.

### D3. Window security
`BrowserWindow` with `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`,
`webSecurity: true`. Deny `window.open` and navigation away from the bundled page (`setWindowOpenHandler`,
`will-navigate`). CSP meta in `index.html`: `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src
'self' data:`. Fonts (Geist, Geist Mono) are bundled via `@fontsource`.

### D4. UI foundation
shadcn/ui initialized for Tailwind v4 (new-york). The color tokens from `docs/ui.md` go in `globals.css` as
CSS variables under `:root` and `.dark`; add `success`, `warning`, `info` tokens beside shadcn's own. The
theme follows `nativeTheme.shouldUseDarkColors` for "Same as Windows" (main sends an event on change). Routing
is a simple state switch, no router library needed.

### D5. Settings and logs
`electron-store` with a Zod-validated schema and defaults; on a parse failure, reset to defaults and log.
`electron-log` writing to `app.getPath('userData')/logs`, 5 MB × 5 files.

### D6. Checks
`npm run check` = eslint + prettier check + `tsc --noEmit` (all three tsconfigs) + `vitest run` + build +
`playwright test`. The e2e smoke test launches the built app, checks the sidebar, switches themes, and checks
that `window.require` is undefined in the renderer.

## Risks / Trade-offs

- shadcn's CLI and Tailwind v4 change often; pin versions in `package.json` and record them in the commit.
