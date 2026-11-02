# Shelved OpenSpec drafts: Protractor invoice export

These four change folders were drafted for the **rejected** network-fetch-plus-rebuild approach to downloading
invoice PDFs from Protractor. They were never built. They are kept here only as reference, moved out of
`openspec/changes/` so they are not mistaken for active work (their `.openspec.yaml` markers were removed, so the
OpenSpec CLI ignores them).

Read `../protractor-invoice-export.md` first. If this feature is resumed, the chosen direction is desktop
automation of the running Protractor app, which needs no `add-protractor-login` (the user signs in to Protractor
itself) and no `generate-invoice-pdfs` (we export the genuine PDF). Rewrite fresh changes rather than un-shelving
these as-is; only `clean-up-generated-pdfs` still applies in spirit (delete exported PDFs after a confirmed upload).

- `add-protractor-login` — a Protractor credentials card. Not needed by desktop automation.
- `add-protractor-invoice-fetch` — the read-only network client. Superseded by driving the app.
- `generate-invoice-pdfs` — rebuild a PDF from fetched data. Not needed; we get the real PDF.
- `clean-up-generated-pdfs` — delete exported PDFs after upload. Still relevant in spirit.
