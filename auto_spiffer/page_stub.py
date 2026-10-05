"""TEST MODE only: makes the saved copy of the claim page behave like the live one for the two things
that need the website's server (Add, and uploading a file).

The saved page's own scripts still run (the dropdown, the text boxes), so typing is tested for real.
Only `__doPostBack` (what Add calls) and the file input are replaced. Nothing here is ever loaded
on the live site, and test mode also blocks every web request so nothing can reach the real server.
"""
from __future__ import annotations

from typing import Optional

STUB_JS = r"""
(() => {
  if (window.__stub) return;
  const S = window.__stub = { rows: [], files: [], nextClicked: false, window: null, posts: [], clicks: [] };
  const $id = (id) => document.getElementById(id);
  const DATE = 'ctl00_DefaultContent_InvoiceDateRadDatePicker_dateInput';
  const INVOICE = 'ctl00_DefaultContent_InvoiceNumberTextBox';
  const SELECT = 'DefaultContent_ProductDropdownList';
  const QTY = 'ctl00_DefaultContent_QtyClaimedRadNumericTextBox';

  function parseDate(s) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || '').trim());
    if (!m) return null;
    const d = new Date(+m[3], +m[1] - 1, +m[2]);
    return d.getMonth() === +m[1] - 1 ? d : null;
  }
  function limits() {
    if (S.window) return [parseDate(S.window[0]), parseDate(S.window[1])];
    try {
      const j = JSON.parse($id('ctl00_DefaultContent_InvoiceDateRadDatePicker_ClientState').value);
      const f = (t) => { const p = t.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
      return [f(j.minDateStr), f(j.maxDateStr)];
    } catch (e) { return [null, null]; }
  }
  function show(id) { const e = $id(id); if (e) e.style.display = 'block'; }
  function hide(id) { const e = $id(id); if (e) e.style.display = 'none'; }

  function reject(messages) {
    const panel = $id('DefaultContent_ValidationPopupPanel');
    let box = $id('stub-validation');
    if (!box) { box = document.createElement('div'); box.id = 'stub-validation'; panel.appendChild(box); }
    box.style.cssText = 'position:relative;z-index:99999;background:white;padding:8px;';
    box.innerHTML = '<div class="modal-body"></div><button type="button" id="stub-validation-ok">OK</button>';
    box.querySelector('.modal-body').textContent = messages.join(' ');
    $id('stub-validation-ok').onclick = () => hide('DefaultContent_ValidationPopupPanel');
    show('DefaultContent_ValidationPopupPanel');
  }

  function addRow(force) {
    const date = $id(DATE).value.trim();
    const invoice = $id(INVOICE).value.trim();
    const sel = $id(SELECT);
    const opt = sel.options[sel.selectedIndex];
    const product = opt && opt.value !== '0' ? opt.text.trim() : '';
    const qty = $id(QTY).value.trim();

    const problems = [];
    const d = parseDate(date);
    const [lo, hi] = limits();
    if (!d) problems.push('Enter the sale date as mm/dd/yyyy.');
    else if ((lo && d < lo) || (hi && d > hi)) problems.push('The sale date is outside the promotion dates.');
    if (!invoice) problems.push('Enter the invoice number.');
    if (!product) problems.push('Select a product.');
    if (!/^\d{1,3}$/.test(qty) || +qty < 1) problems.push('Enter a quantity.');
    if (problems.length) { S.lastError = problems.join(' '); return reject(problems); }

    const key = [date, invoice, product].join('|');
    if (!force && S.rows.some((r) => [r.date, r.invoice, r.product].join('|') === key)) {
      return show('DefaultContent_DuplicateLineItemMessagePopupPanel');
    }
    hide('DefaultContent_DuplicateLineItemMessagePopupPanel');
    S.rows.push({ date, invoice, product, qty });

    const table = $id('ctl00_DefaultContent_ProductRadGrid_ctl00');
    const body = table.querySelector('tbody');
    const none = body.querySelector('.rgNoRecords');
    if (none) none.remove();
    const tr = document.createElement('tr');
    tr.className = body.querySelectorAll('tr').length % 2 ? 'rgAltRow' : 'rgRow';
    [['Delete', 'a'], [date], [invoice], [product], [qty]].forEach((c) => {
      const td = document.createElement('td');
      if (c[1] === 'a') { const a = document.createElement('a'); a.href = '#'; a.textContent = c[0]; td.appendChild(a); }
      else td.textContent = c[0];
      tr.appendChild(td);
    });
    body.appendChild(tr);

    $id(DATE).value = ''; $id(INVOICE).value = ''; $id(QTY).value = '';
    sel.value = '0';
    if (window.jQuery) window.jQuery(sel).trigger('chosen:updated');
  }

  window.__doPostBack = function (target) {
    S.posts.push(target);
    if (/AddProductLinkButton$/.test(target)) return addRow(false);
    if (/YesLinkButton$/.test(target)) return addRow(true);
    if (/GoToStepFour/.test(target)) { S.nextClicked = true; }
  };
  window.HideDuplicateLineItemMessagePopupPanel = () => hide('DefaultContent_DuplicateLineItemMessagePopupPanel');

  // A file chosen for upload: show it as attached (the real server would save and list it).
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || t.id !== 'ctl00_DefaultContent_FileUploadRadAsyncUploadfile0') return;
    e.stopImmediatePropagation();
    for (const f of Array.from(t.files || [])) {
      S.files.push(f.name);
      show('DefaultContent_UploadedFilesPanel');
      const grid = $id('ctl00_DefaultContent_FilesRadGrid');
      let table = grid.querySelector('table.stub-files');
      if (!table) {
        table = document.createElement('table'); table.className = 'stub-files';
        table.appendChild(document.createElement('tbody')); grid.appendChild(table);
      }
      const tr = document.createElement('tr'); tr.className = 'rgRow';
      const td = document.createElement('td'); td.textContent = f.name; tr.appendChild(td);
      table.querySelector('tbody').appendChild(tr);
    }
    t.value = '';
  }, true);

  // Record every click on anything that must never be clicked.
  document.addEventListener('click', (e) => {
    const a = e.target.closest ? e.target.closest('a, button, input') : null;
    if (a && a.id) S.clicks.push(a.id);
  }, true);
})();
"""


def install_stub(page, window: Optional[tuple[str, str]] = None) -> None:
    """Install the test stub. `window` = (first, last) allowed sale date as mm/dd/yyyy, or None to
    keep the page's own program dates."""
    page.evaluate(STUB_JS)
    page.evaluate("w => { window.__stub.window = w; }", list(window) if window else None)
