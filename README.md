# Auto Spiffer

Auto Spiffer helps a tire shop enter its monthly ATD ProRewards sales claim. It reads a Protractor Material Sales export and invoice PDFs, matches eligible tires to the claim page, enters the sales, and uploads the PDFs. **It never submits the claim.** A person checks the page and clicks Next and Submit on the website.

## Install on Windows

1. Open the [latest release](https://github.com/levicavagnetto/auto-spiffer/releases/latest) and download `Auto-Spiffer-Setup-<version>.exe`.
2. Run the Setup file. It installs for your Windows account without administrator access, then opens Auto Spiffer. Start Menu and desktop shortcuts are added.
3. This version is not code signed. If Windows SmartScreen says it protected your PC, check that the file came from this repository's release page, then choose **More info** and **Run anyway**.

The installed app checks for stable updates when it starts and every six hours. It downloads them in the background. When a version is ready, choose **Restart to update**, or close the app. An update waits until any claim entry in progress has finished. In Settings you can turn automatic updates off and use **Check now** instead.

## Enter a month's claim

1. On **Sales**, choose that month's Protractor **Material Sales** `.xlsx` file. Add the invoice PDFs or the folder containing them. The app links a PDF to a sale by its invoice number. Sales without a PDF can still be entered; upload those invoices by hand on the website.
2. Set your ProRewards email and password in **Settings** if you want the app to sign in. The password is encrypted with your Windows account. You can also sign in yourself in the **ProRewards** tab.
3. Click **Match tires**. The app opens the month's program and reads the Eligible Product list. On **Review**, decide any tire it could not match confidently. Leave out lines that do not belong on the claim.
4. Open **Enter claims**, check the plan, then click **Start entering**. The app checks the existing sale list before each line so it does not enter the same sale twice. You can pause or stop; it finishes the current line before stopping.
5. Read the result summary and check every sale and PDF on the ProRewards claim page. Use **Check page and run again** if needed. **You click Next and Submit on the website yourself.**

The app remembers saved tire matches, settings, the encrypted password, and website cookies. It does not remember which month or invoice was entered. Keep the Material Sales file and PDFs until the claim is complete.

## Moving from version 0.4.0

Version 1.0 installs in `%LOCALAPPDATA%\Programs\AutoSpiffer`. The old 0.x app lives in `%LOCALAPPDATA%\Programs\Auto Spiffer`. Installing 1.0 does not remove the old program or its `data` folder. Its saved tire choices do not carry over, so review matches carefully the first month.

If the old app's **Update** button opens the 1.0 release page, download the new `Auto-Spiffer-Setup-<version>.exe` there and run it. After you have checked the new app, uninstall the old **Auto Spiffer** entry from Windows Settings. During the switch, the two installations may both appear as **Auto Spiffer**. Check the install path if you are unsure which entry is the old one.

Uninstalling 1.0 leaves its app data in `%APPDATA%\Auto Spiffer`, including saved matches and settings. The **Logs** card in Settings opens `%APPDATA%\Auto Spiffer\logs`.

## For developers

Windows 11 and Node.js 24 are the supported development setup.

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run check
npm.cmd run dist:win
```

`npm.cmd run check` runs lint, formatting, typecheck, unit tests, a build, and Electron end-to-end tests. Tests that require the gitignored `private-data/` folder skip when it is absent. `npm.cmd run dist:win` builds the Windows installer in `release/` without publishing it. `npm.cmd run make:icons` regenerates the committed icons from `docs/brand/logo.svg`.

Implementation decisions are in [docs/architecture.md](docs/architecture.md), screens and copy in [docs/ui.md](docs/ui.md), and the milestone plans in [openspec/changes](openspec/changes).
