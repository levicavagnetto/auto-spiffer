# Tasks

## 1. Delete safely

- [ ] 1.1 `deleteMadePdf` with the path guard (design D2); verify unit tests that picked PDFs and paths outside the temp root are refused

## 2. After upload

- [ ] 2.1 Delete made PDFs after a confirmed upload and mark them uploaded (design D1); verify unit tests for confirmed, failed and picked uploads
- [ ] 2.2 Rerun handling (design D4); verify unit tests that an uploaded made PDF is not missing, is not uploaded again, and is made again when a rerun adds a new line

## 3. Sweeps

- [ ] 3.1 Delete on export replace or remove, on quit and on startup (design D3); verify unit tests with a temp folder, and an e2e test that leftover files are gone after launch

## 4. Screens and docs

- [ ] 4.1 Show Uploaded for deleted made PDFs on Sales and Enter claims; verify a Playwright e2e test with a fake run
- [ ] 4.2 Update `docs/architecture.md` Storage section

## 5. Done

- [ ] 5.1 `openspec validate clean-up-generated-pdfs --strict`, `npm test`, `npm run test:e2e`
