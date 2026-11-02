# Tasks

## 1. Store

- [ ] 1.1 Confirm from the capture decoding (change 11, task 1.2) that sign-in needs only a username and password; if not, update this change's spec, design and card first
- [ ] 1.2 Protractor credentials store (design D1); verify unit tests: password never in the file, save refused without encryption, empty fields refused, damaged file resets, undecryptable password reads as none, Forget leaves the ProRewards file untouched

## 2. IPC and state

- [ ] 2.1 IPC channels and the session login state (design D2, D3) with Zod schemas; verify a unit test that the password is never returned

## 3. Settings card

- [ ] 3.1 Protractor login card above ProRewards sign-in (design D4) with save, forget, field errors and the state line; verify a Playwright e2e test of save, forget and card order
- [ ] 3.2 Update `docs/ui.md` (Settings order) and `docs/architecture.md` (Storage table)

## 4. Done

- [ ] 4.1 `openspec validate add-protractor-login --strict`, `npm test`, `npm run test:e2e`
