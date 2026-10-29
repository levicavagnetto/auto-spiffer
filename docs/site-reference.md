# ProRewards site reference

What the app needs to know about the ProRewards website (`https://prorewards.acbrewards.com/`). The site is
ASP.NET WebForms with Telerik controls, jQuery, Bootstrap and the Chosen dropdown plugin. Saved copies of the
pages are in `private-data/site-pages/` (gitignored). Everything here was confirmed on the live site by the
old app (v0.4.0, `origin/legacy`), unless it says otherwise.

Keep every selector in one module (`src/main/site/selectors.ts`) so a site change is a one-line fix.

## Pages

| Page | Address | Notes |
|---|---|---|
| Login | `/Login.aspx` (also where any signed-out page redirects) | See Login below |
| Home | `/Authorized/Home.aspx` | Menu: Claims > Claim Search, Submit Sale |
| Submit Sale | `/authorized/claims/submitsale.aspx` | First shows the **program choice** step, then the claim page (step 3) |
| Claim form (tire list) | `ClaimForm.aspx?pid=..&did=..` link on the claim page | Not used by the app |
| Log out | `/Authorized/LogOut.aspx` | Never visited by the app |

## Login page

| Item | Selector |
|---|---|
| Email | `#UserLogin_UserName` |
| Password | `#UserLogin_Password` |
| Log in | `#UserLogin_Login`, a link that runs `__doPostBack('UserLogin$Login','')` |

Signed in is detected by the password box disappearing and the page leaving `/Login.aspx`. The app tries a
login **once** per saved password. The login page's `.errorLiteral` reports a rejected password; the app stops
when it appears. If no error appears, the app waits up to 10 seconds. Saving a replacement password permits
another attempt in the open app. A code or CAPTCHA leaves the person to finish by hand in the tab.

## Program choice (Submit Sale, before the claim page)

Saved as `private-data/site-pages/ATD ProRewards - Submit Sales.htm`. The October copy confirms:

| Item | Selector |
|---|---|
| Program choice step | `#DefaultContent_StepOneUpdatePanel` |
| Program `<select>` | `#DefaultContent_PromotionDropDownList` (hidden behind Chosen) |
| Chosen widget | `#DefaultContent_PromotionDropDownList_chosen` |
| Chosen choices | `#DefaultContent_PromotionDropDownList_chosen .chosen-results li` |
| Next on program choice | `#DefaultContent_PromotionCodeNextLinkButton` (`NEXT`) |

The saved list contains `Select One` and `October 2026 Pro Rewards`. The month's entry contains the month name
and year, for example `September 2026 Pro Rewards`. The Next link posts back from step one.

The app picks the entry only when exactly one matches the month, clicks that page's Next only on this step
(never on the claim page), and otherwise leaves the person to choose.

## Claim page (step 3)

The page header shows `Promotion Name: <program> (<m/d/yyyy> - <m/d/yyyy>)`, for example
`Promotion Name: October 2026 Pro Rewards (10/1/2026 - 10/31/2026)`. The page is recognized when every
selector marked *required* below is present.

| Item | Selector | Required |
|---|---|---|
| Sale Date (Telerik date input) | `#ctl00_DefaultContent_InvoiceDateRadDatePicker_dateInput` | yes |
| Date picker client state (JSON with `minDateStr`, `maxDateStr`: the program window) | `#ctl00_DefaultContent_InvoiceDateRadDatePicker_ClientState` | |
| Invoice # (text, max 50) | `#ctl00_DefaultContent_InvoiceNumberTextBox` | yes |
| Eligible Product (hidden `<select>`) | `#DefaultContent_ProductDropdownList` | yes |
| Eligible Product (the Chosen widget a person sees) | `#DefaultContent_ProductDropdownList_chosen` | yes |
| Qty (Telerik numeric, max 3 digits) | `#ctl00_DefaultContent_QtyClaimedRadNumericTextBox` | yes |
| Add (link running `__doPostBack`, a partial page update) | `#DefaultContent_AddProductLinkButton` | yes |
| Cumulative Sale(s) List (Telerik grid) | `#ctl00_DefaultContent_ProductRadGrid_ctl00` | yes |
| Upload file input (the site swaps in a new one after each upload, so always use the **last**) | `#ctl00_DefaultContent_FileUploadRadAsyncUpload input[type=file]` | yes |
| Uploaded files panel | `#DefaultContent_UploadedFilesPanel` | |
| Duplicate popup ("Confirm - Duplicate Line Item Entered") | `#DefaultContent_DuplicateLineItemMessagePopupPanel` | |
| Duplicate popup's No button | `#DefaultContent_DuplicateLineItemMessagePopupPanel button` | |
| Validation popup | `#DefaultContent_ValidationPopupPanel` | |

**Tire list:** the `<select>`'s option texts, whitespace squeezed, without `Select One`. Labels look like
`General Altimax RT45 - Passenger Tires`: brand and model, then ` - `, then the category. Wheels have no
category (`ATD Steel Wheels`) and are never matched to a tire. The October 2026 list is in
`docs/reference/tire-list-2026-10.txt`.

**Sale list columns:** Sale Date, Invoice Number, Product, Qty Claimed, Action. Find columns by header text
(`sale date`, `invoice`, `product`, `qty`/`quantity`), falling back to positions 1, 2, 3, 4. Skip rows with the
class `rgNoRecords` or fewer than 4 cells. A line's identity on the page is (sale date, invoice, product).

**Uploads:** RadAsyncUpload, `.pdf`, many files allowed, renamed by the site to be unique. An upload counts as
done when the number of elements matching any of these grows:
`#DefaultContent_UploadedFilesPanel table tbody tr`, `.ruUploadSuccess`.

## Never-click list

The app refuses to click any of these, anywhere, ever. Enforce it in the one function every click goes
through, and test it.

```
#DefaultContent_GoToStepFourLinkButton        (Next on the claim page)
#DefaultContent_BackToStepTwoLinkButton       (Back)
#DefaultContent_YesLinkButton                 (Yes on the duplicate popup)
#DefaultContent_SubmitDuplicatesLinkButton
#DefaultContent_PostClaimDuplicatesLinkButton
```

Also refuse any element whose visible text is `Next` or `Submit` once the claim page is showing.

## Scripts that work

### Filling a line through the page's own controls

Filling through the controls' own APIs is fast and works when the window is minimized or behind other
windows (mouse and keyboard events barely run in a minimized window: the old app went from about 10 seconds
to well under 1 second per tire with this). Run it in the page; it returns `null` on success, or why not.

```js
([ids, ymd, invoice, label, qty]) => {
  try {
    const [dateId, pickerId, invoiceId, selectId, qtyId] = ids;
    if (!window.$find || !window.jQuery) return 'the page has no controls to set';
    const dateBox = $find(dateId), picker = pickerId ? $find(pickerId) : null;
    const invoiceBox = $find(invoiceId), qtyBox = $find(qtyId);
    const select = document.getElementById(selectId);
    if (!dateBox || !invoiceBox || !qtyBox || !select) return 'the boxes were not found as controls';
    const option = Array.from(select.options).find(o => o.text.replace(/\s+/g, ' ').trim() === label);
    if (!option) return 'the tire is not in the list';
    const when = new Date(ymd[0], ymd[1] - 1, ymd[2]);
    if (picker && picker.get_dateInput && picker.get_dateInput()) picker.set_selectedDate(when);
    else dateBox.set_selectedDate(when);
    invoiceBox.set_value(invoice);
    select.value = option.value;
    jQuery(select).trigger('change').trigger('chosen:updated');
    qtyBox.set_value(qty);
    return null;
  } catch (e) { return String(e && e.message || e); }
}
```

`ids` are the element ids without `#`: the date input, the date picker (the date input id without
`_dateInput`), invoice, product select, qty. After it runs, read the four boxes back and compare before
clicking Add. The old app kept a typing fallback (focus, select all, insert text, Tab) for when this fails;
keep one too, but expect it to be rare.

### Knowing when the site answered

Add is an ASP.NET partial postback. These tell when one is running and count the ones that finished:

```js
// busy?
() => { try { return Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack(); }
        catch (e) { return false; } }

// install a counter once per page load
() => {
  let prm;
  try { prm = Sys.WebForms.PageRequestManager.getInstance(); } catch (e) { return false; }
  if (!window.__spiffer) {
    const w = window.__spiffer = { answered: 0, began: 0, took: 0 };
    prm.add_beginRequest(() => { w.began = performance.now(); });
    prm.add_endRequest(() => { w.answered += 1; w.took = performance.now() - w.began; });
  }
  return true;
}
```

Adding a line: wait until not busy, read the sale list, fill, confirm the boxes, check no popup is open and
Add is visible, note `__spiffer.answered`, click Add (`element.click()` in the page, not a mouse event), then
poll every 50 ms until one of:
- the duplicate popup shows: outcome *duplicate* (click its No button);
- the validation popup shows: outcome *rejected* with its text (dismiss with its OK, Close or Cancel button,
  or Escape);
- the sale list has one more row with this (date, invoice, product): *added* if its quantity matches, else
  *mismatch*;
- the answered counter grew, nothing is busy, and 1.5 seconds passed with no new row: *timeout*;
- 25 seconds passed: *timeout*.

### Program dates

Read `minDateStr` and `maxDateStr` from the date picker's client state JSON (format `yyyy-mm-dd-hh-mm-ss`).

### Uploading a file without a port

With `webContents.debugger.attach('1.3')`: `Runtime.evaluate` an expression returning the last file input
(`returnByValue: false`), then `DOM.setFileInputFiles({ files: [absolutePath], objectId })`. Then wait for the
upload-done count to grow (90 seconds at most). This is the riskiest step of the whole design; change `02`
proves it.

## Testing against the saved page

The saved claim page (`private-data/site-pages/ATD ProRewards - Submit Claim.htm` and its `_files` folder)
runs its own scripts, so the dropdown and the Telerik boxes really work. Two things need the server: Add and
uploads. The old app replaced them with a small stub; see `git show origin/legacy:auto_spiffer/page_stub.py`.
It overrides `__doPostBack` to append a row to the grid (or show the duplicate or validation popup) and
fakes upload success, and it records every click so a test can prove Next was never clicked. In tests, block
every request that is not `file:` so nothing reaches the real site.

A committed test page must not contain the dealership name, dealer or program ids, or ViewState. Make a
trimmed copy for committed tests, or keep these tests in `*.private.test.ts`.
