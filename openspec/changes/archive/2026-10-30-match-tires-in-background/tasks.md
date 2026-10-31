# Tasks

## 1. Background site preparation

- [x] 1.1 Load the existing ProRewards view when Match tires runs, even if the view is hidden.
- [x] 1.2 Return promptly when unattended program navigation needs manual help; report login failure plainly.

## 2. Sales flow

- [x] 2.1 Keep Sales visible during matching and open Review only after success.
- [x] 2.2 Show a temporary dismissible error toast on failure without switching tabs.

## 3. Verification

- [x] 3.1 Test hidden-view matching, login failure, and unattended navigation.
- [x] 3.2 Run typecheck, lint, build, focused tests, and strict OpenSpec validation.

## 4. Sign-in follow-up

- [x] 4.1 Show only "Could not log in" in the login toast, without Electron's IPC error wrapper.
- [x] 4.2 Detect the site's login error and shorten the fallback timeout to 10 seconds.
- [x] 4.3 Retry after a new password is saved in the same app session.
- [x] 4.4 Verify wrong-then-correct password behavior with focused tests.
