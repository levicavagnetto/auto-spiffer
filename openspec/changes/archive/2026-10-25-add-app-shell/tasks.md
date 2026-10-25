# Tasks

## 1. Project

- [x] 1.1 Scaffold electron-vite with React + TypeScript at the repo root (npm), strict tsconfigs, eslint, prettier; verify `npm run dev` opens a window
- [x] 1.2 Add Tailwind v4 and shadcn/ui (new-york), bundled Geist fonts, and the color tokens from `docs/ui.md` (light and dark, plus success, warning, info); verify a token test that every token in `docs/ui.md` exists in `globals.css`
- [x] 1.3 Add Vitest and Playwright `_electron`, and `npm run check` running lint, format check, typecheck, unit tests, build and e2e; verify it passes on the empty app

## 2. Main process and bridge

- [x] 2.1 Window security per design D3 (sandbox, isolation, CSP, no new windows, no navigation away); verify an e2e test that `window.require` and `window.process` are undefined in the renderer
- [x] 2.2 The IPC contract in `src/shared/ipc.ts` with Zod schemas, the preload bridge built from it, and main handlers that validate input (design D2); verify unit tests that unknown calls and invalid input are rejected and logged
- [x] 2.3 Settings store (theme, window bounds) with defaults and the damaged-file fallback; verify unit tests for defaults, round trip and a corrupt file
- [x] 2.4 Logging per design D5 and a global handler that logs unexpected errors and sends the plain message to the screen; verify a unit test with a thrown error
- [x] 2.5 Single-instance lock that focuses the open window; verify an e2e test that a second launch exits and the first window is focused

## 3. Screens

- [x] 3.1 The sidebar from `docs/ui.md` with the logo (`docs/brand/logo.svg`), the six items, disabled steps with tooltips, and the version; verify a component test for the disabled states
- [x] 3.2 Empty Sales, Review, Enter claims, ProRewards and Settings screens with their headers; Settings has the Appearance card working (Light, Dark, Same as Windows); verify e2e tests for navigation, theme switching, the theme kept after restart, and the window size kept after restart

## Workflow follow-up

- Run `openspec validate add-app-shell --strict` and `npm run check`, then archive.
