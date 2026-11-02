# Design

## Context

ProRewards credentials live in `src/main/credentials.ts`: an electron-store file (`credentials`) validated with Zod,
holding the email and a `safeStorage`-encrypted password. The renderer only receives
`{ email, hasPassword, staySignedIn }`. Settings shows a ProRewards sign-in card. Protractor needs the same treatment
for a different account.

## Goals / Non-Goals

**Goals:** a second, separate, encrypted login; a Settings card above ProRewards; a session-only state that change
11 updates.

**Non-Goals:** contacting Protractor (change 11), a "test login" button (the first real fetch tests it), storing
which invoices were fetched.

## Decisions

### D1. A separate store file, same pattern

`src/main/protractor/credentials.ts` opens an electron-store named `protractor-credentials` holding
`{ username, encryptedPassword }`, with the same Zod `deserialize` guard, `clearInvalidConfig`, and
`AccountEncryption` interface as the ProRewards store, so tests use a fake. The username is a trimmed, non-empty
string, not an email. A separate file keeps the two accounts independent, so Forget login cannot touch ProRewards.

Alternative: one credentials file with two sections. Rejected because it couples unrelated accounts and changes the
existing file format.

### D2. Session state in memory

`ProtractorLoginState = 'not-tried' | 'signed-in' | 'refused' | 'unreachable'` lives in the main process and is
pushed to the renderer when it changes. Save and Forget reset it to `not-tried`. Change 11 sets the other values.

### D3. IPC

`protractor:read`, `protractor:save(username, password)`, `protractor:forget`, and a `protractor:state` event, all
Zod-checked in `src/shared/ipc.ts`. The password crosses IPC only on save.

### D4. Card

A shadcn Card styled like the ProRewards card and placed above it. Copy: "Auto Spiffer uses this to get invoice PDFs
you have not added. Optional."

## Risks / Trade-offs

- [Two passwords to keep current] → The state line tells the person when Protractor refuses the login.
- [Protractor sign-in may need more than a username and password, such as a location] → Change 11 decodes the
  capture's sign-in first (task 1.2 there). If more fields are needed, update this change before building it.

## Migration Plan

New file only; nothing to migrate.

## Open Questions

- Does Protractor sign-in need anything besides a username and password? Answered by change 11, task 1.2.
