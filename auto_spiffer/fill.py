"""Entering sales on the ATD ProRewards "Submit a Sales Claim" page, with Playwright.

Three layers:
  ClaimPage  one Playwright page: find the fields, type into them, click Add, read the list, upload.
  Filler     the loop over sales: skip what is already there, retry once, upload each invoice's PDF.
  check_page what must be true BEFORE entering anything (right program, dates, every tire in the list).

The app never clicks Next, Save Claim, or Submit. ClaimPage refuses to click anything on the
never-click list in config.toml, so that rule is enforced in code, not just by habit.
"""
from __future__ import annotations

import hashlib
import re
import threading
import time
import tomllib
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Callable, Optional

from auto_spiffer import paths
from auto_spiffer.catalog import Catalog
from auto_spiffer.models import ClaimRow, format_page_date
from auto_spiffer.state import State


class FillError(Exception):
    """Something went wrong while entering. The message is written for the person using the app."""


# ----------------------------------------------------------------------- config
@dataclass
class FillConfig:
    live_url: str
    browser: str
    timeouts: dict[str, float]
    selectors: dict[str, str]
    never_click: set[str]
    upload_done: list[str]
    login: "LoginConfig" = field(default_factory=lambda: LoginConfig())


@dataclass
class LoginConfig:
    """Where things are on the login page and the program list (CSS selectors), from [login]."""
    claim_url: str = "https://prorewards.acbrewards.com/authorized/claims/submitsale.aspx"
    username: str = "input[type='email'], input[type='text']"
    password: str = "input[type='password']"
    submit: str = "input[type='submit'], button[type='submit']"
    program_items: str = "select option, a"
    program_go: str = ""
    form_wait: float = 6.0
    login_wait: float = 20.0


def load_config(path: Optional[Path] = None) -> FillConfig:
    """Read config.toml from the data folder (created from the defaults on first use)."""
    path = path or paths.ensure_data_file("config.toml")
    try:
        with open(path, "rb") as handle:
            data = tomllib.load(handle)
        return FillConfig(
            live_url=data["site"]["live_url"], browser=data["site"].get("browser", "auto"),
            timeouts={k: float(v) for k, v in data["timeouts"].items()},
            selectors=dict(data["selectors"]),
            never_click=set(data.get("never_click", {}).get("selectors", [])),
            upload_done=list(data.get("upload", {}).get("done_selectors", [])),
            login=LoginConfig(**{k: v for k, v in data.get("login", {}).items()
                                 if k in LoginConfig.__dataclass_fields__}),
        )
    except (OSError, KeyError, ValueError, TypeError, tomllib.TOMLDecodeError) as exc:
        raise FillError(f"config.toml could not be read ({exc.__class__.__name__}: {exc}). "
                        "Delete it from the data folder to get a fresh copy.") from exc


BROWSER_CHOICES = ("auto", "chrome", "msedge")


def update_config(live_url: Optional[str] = None, browser: Optional[str] = None,
                  path: Optional[Path] = None) -> None:
    """Change the site address and/or browser in config.toml, leaving its comments and the rest alone."""
    if live_url is not None and not re.match(r"^https?://\S+$", live_url.strip()):
        raise FillError("The site address must start with http:// or https:// and have no spaces.")
    if browser is not None and browser not in BROWSER_CHOICES:
        raise FillError("The browser must be one of: " + ", ".join(BROWSER_CHOICES) + ".")
    path = path or paths.ensure_data_file("config.toml")
    text = path.read_text(encoding="utf-8")
    if live_url is not None:
        text = re.sub(r'(?m)^live_url\s*=.*$', lambda _m: f'live_url = "{live_url.strip()}"', text)
    if browser is not None:
        text = re.sub(r'(?m)^browser\s*=.*$', lambda _m: f'browser = "{browser}"', text)
    try:
        tomllib.loads(text)
    except tomllib.TOMLDecodeError as exc:
        raise FillError(f"config.toml would become unreadable, so nothing was changed ({exc}).") from exc
    path.write_text(text, encoding="utf-8")


# ------------------------------------------------------------------ small helpers
def _parse_page_date(text: str) -> Optional[date]:
    text = text.strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d-%H-%M-%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _squash(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def file_hash(path: str | Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


@dataclass(frozen=True)
class GridRow:
    """One line of the page's Cumulative Sale(s) List."""
    sale_date: Optional[date]
    invoice: str
    product: str
    qty: Optional[int]

    @property
    def key(self) -> tuple:
        return (self.sale_date, self.invoice, self.product)


@dataclass
class PageInfo:
    promotion: Optional[str]
    window: tuple[Optional[date], Optional[date]]
    options: list[str]
    rows: list[GridRow]
    counts: dict[str, int]


@dataclass
class AddResult:
    outcome: str   # added, duplicate, rejected, mismatch, timeout
    message: str = ""

    @property
    def ok(self) -> bool:
        return self.outcome == "added"


# --------------------------------------------------------------------- the page
REQUIRED = ("date", "invoice", "product_select", "product_chosen", "qty", "add", "grid", "upload_input")


class ClaimPage:
    def __init__(self, page, cfg: FillConfig):
        self.page, self.cfg = page, cfg

    # --------------------------------------------------------------- finding things
    def sel(self, key: str) -> str:
        return self.cfg.selectors[key]

    def loc(self, key: str):
        return self.page.locator(self.sel(key))

    def counts(self) -> dict[str, int]:
        return {key: self.page.locator(sel).count() for key, sel in self.cfg.selectors.items()}

    def is_claim_page(self) -> bool:
        counts = self.counts()
        return all(counts.get(key, 0) > 0 for key in REQUIRED)

    @staticmethod
    def find(context, cfg: FillConfig) -> Optional["ClaimPage"]:
        """The open tab that is showing the claim form (the person may have several open)."""
        for page in reversed(list(context.pages)):
            try:
                claim = ClaimPage(page, cfg)
                if claim.is_claim_page():
                    return claim
            except Exception:
                continue  # a tab that is closing or still loading
        return None

    def _visible(self, key: str) -> bool:
        loc = self.loc(key)
        return loc.count() > 0 and loc.first.is_visible()

    def _click(self, key: str) -> None:
        """Click a named control, unless it is on the never-click list."""
        selector = self.sel(key)
        if selector in self.cfg.never_click or key == "next_button":
            raise FillError(f"Refusing to click '{key}'. Auto Spiffer never submits the claim.")
        self.loc(key).first.click(timeout=self.cfg.timeouts["action"] * 1000)

    # ----------------------------------------------------------------- reading
    def promotion(self) -> Optional[str]:
        text = self.page.evaluate("() => document.body.innerText")
        match = re.search(r"Promotion Name:\s*(.+)", text)
        return _squash(match.group(1)) if match else None

    def date_window(self) -> tuple[Optional[date], Optional[date]]:
        raw = self.page.evaluate(
            """(sel) => {
                const S = window.__stub;
                if (S && S.window) return S.window;
                const el = document.querySelector(sel);
                if (!el) return null;
                try { const j = JSON.parse(el.value); return [j.minDateStr, j.maxDateStr]; }
                catch (e) { return null; }
            }""", self.sel("date_client_state"))
        if not raw:
            return None, None
        return _parse_page_date(raw[0] or ""), _parse_page_date(raw[1] or "")

    def options(self) -> list[str]:
        texts = self.loc("product_select").first.evaluate(
            "s => Array.from(s.options).map(o => o.text.trim())")
        return [t for t in texts if t and t.lower() != "select one"]

    def grid_rows(self) -> list[GridRow]:
        data = self.page.evaluate(
            """(sel) => {
                const t = document.querySelector(sel);
                if (!t) return null;
                const heads = Array.from(t.querySelectorAll('thead th')).map(h => h.innerText.trim().toLowerCase());
                const rows = Array.from(t.querySelectorAll('tbody tr'))
                    .filter(r => !r.classList.contains('rgNoRecords') && r.querySelectorAll('td').length >= 4)
                    .map(r => Array.from(r.querySelectorAll('td')).map(c => c.innerText.trim()));
                return { heads, rows };
            }""", self.sel("grid"))
        if not data:
            return []
        heads = data["heads"]

        def column(*names: str, fallback: int) -> int:
            for i, head in enumerate(heads):
                if any(n in head for n in names):
                    return i
            return fallback

        d, inv = column("sale date", fallback=1), column("invoice", fallback=2)
        prod, qty = column("product", fallback=3), column("qty", "quantity", fallback=4)
        rows = []
        for cells in data["rows"]:
            try:
                rows.append(GridRow(_parse_page_date(cells[d]), cells[inv], _squash(cells[prod]),
                                    int(re.sub(r"\D", "", cells[qty]) or 0) or None))
            except IndexError:
                continue
        return rows

    def read_info(self) -> PageInfo:
        return PageInfo(self.promotion(), self.date_window(), self.options(), self.grid_rows(),
                        self.counts())

    # ----------------------------------------------------------------- typing
    def _type(self, key: str, text: str) -> str:
        """Click the box, replace what is in it, type like a person, leave the box. Returns what it shows."""
        box = self.loc(key).first
        timeout = self.cfg.timeouts["action"] * 1000
        box.click(timeout=timeout)
        self.page.keyboard.press("Control+A")
        self.page.keyboard.press("Delete")
        self.page.keyboard.type(text, delay=25)
        self.page.keyboard.press("Tab")
        time.sleep(0.15)
        return box.input_value(timeout=timeout)

    def set_date(self, text: str) -> None:
        shown = self._type("date", text)
        if _parse_page_date(shown) != _parse_page_date(text):
            raise FillError(f"The date box shows '{shown}' instead of {text}. Is the date inside the "
                            "program's dates?")

    def set_invoice(self, invoice: str) -> None:
        shown = self._type("invoice", invoice)
        if shown.strip() != invoice:
            raise FillError(f"The invoice box shows '{shown}' instead of {invoice}.")

    def set_qty(self, qty: int) -> None:
        shown = self._type("qty", str(qty))
        if re.sub(r"\D", "", shown) != str(qty):
            raise FillError(f"The quantity box shows '{shown}' instead of {qty}.")

    def _selected_product(self) -> str:
        return self.loc("product_select").first.evaluate(
            "s => s.selectedIndex >= 0 ? s.options[s.selectedIndex].text.trim() : ''")

    def select_product(self, label: str) -> None:
        """Pick the product by its exact name: through the visible search list like a person, and
        if that does not take, straight on the hidden list."""
        try:
            chosen = self.page.locator(self.sel("product_chosen")).first
            chosen.locator("a.chosen-single").click(timeout=3000)
            search = chosen.locator("input.chosen-search-input")
            search.press_sequentially(label, delay=10, timeout=3000)
            time.sleep(0.2)
            items = chosen.locator("ul.chosen-results li.active-result")
            for i in range(items.count()):
                if _squash(items.nth(i).inner_text()) == label:
                    items.nth(i).click(timeout=3000)
                    break
        except Exception:
            pass
        if self._selected_product() != label:
            found = self.loc("product_select").first.evaluate(
                """(s, label) => {
                    const o = Array.from(s.options).find(o => o.text.trim() === label);
                    if (!o) return false;
                    s.value = o.value;
                    s.dispatchEvent(new Event('change', { bubbles: true }));
                    if (window.jQuery) window.jQuery(s).trigger('chosen:updated');
                    return true;
                }""", label)
            if not found:
                raise FillError(f"'{label}' is not in the website's product list.")
        if self._selected_product() != label:
            raise FillError(f"Could not select '{label}' in the product list.")

    # --------------------------------------------------------------- adding
    def add_row(self, row: ClaimRow) -> AddResult:
        """Fill the four boxes, click Add, and wait to see what the page did."""
        before = self.grid_rows()
        self.set_date(row.sale_date_str)
        self.set_invoice(row.invoice)
        self.select_product(row.product_text)
        self.set_qty(row.qty)
        self._click("add")
        return self._wait_for_add(row, before)

    def _wait_for_add(self, row: ClaimRow, before: list[GridRow]) -> AddResult:
        want = (row.sale_date, row.invoice, row.product_text)
        was = sum(1 for r in before if r.key == want)
        deadline = time.monotonic() + self.cfg.timeouts["add"]
        while time.monotonic() < deadline:
            if self._visible("duplicate_popup"):
                return AddResult("duplicate", "The page says this line was already entered.")
            if self._visible("validation_popup"):
                message = _squash(self.loc("validation_popup").first.inner_text())
                return AddResult("rejected", message or "The page rejected the line.")
            matching = [r for r in self.grid_rows() if r.key == want]
            if len(matching) > was:
                if any(r.qty == row.qty for r in matching):
                    return AddResult("added")
                return AddResult("mismatch", f"The list shows quantity {matching[-1].qty}, expected {row.qty}.")
            time.sleep(0.15)
        return AddResult("timeout", f"The page did not show the new line within {self.cfg.timeouts['add']:.0f} seconds.")

    def cancel_duplicate(self) -> None:
        """Answer 'No' to the duplicate question. 'Yes' is on the never-click list."""
        self._click("duplicate_no")
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline and self._visible("duplicate_popup"):
            time.sleep(0.1)

    def dismiss_validation(self) -> None:
        panel = self.loc("validation_popup").first
        for name in ("OK", "Ok", "Close", "Cancel"):
            button = panel.get_by_role("button", name=name)
            if button.count() and button.first.is_visible():
                try:
                    button.first.click(timeout=1500)
                except Exception:  # something sits on top of it: press it without the mouse
                    button.first.evaluate("e => e.click()")
                return
        self.page.keyboard.press("Escape")

    # -------------------------------------------------------------- uploading
    def _upload_signal(self) -> int:
        return sum(self.page.locator(sel).count() for sel in self.cfg.upload_done)

    def upload(self, path: str | Path) -> None:
        path = Path(path)
        baseline = self._upload_signal()
        self.loc("upload_input").first.set_input_files(str(path), timeout=self.cfg.timeouts["action"] * 1000)
        deadline = time.monotonic() + self.cfg.timeouts["upload"]
        while time.monotonic() < deadline:
            if self._upload_signal() > baseline:
                return
            time.sleep(0.2)
        raise FillError(f"The invoice PDF {path.name} did not finish uploading within "
                        f"{self.cfg.timeouts['upload']:.0f} seconds.")

    def scroll_top(self) -> None:
        self.page.evaluate("() => window.scrollTo(0, 0)")
        try:
            self.page.bring_to_front()
        except Exception:
            pass


# ------------------------------------------------------------------ page check
@dataclass
class PageCheck:
    ok: bool
    problems: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def check_page(info: PageInfo, rows: list[ClaimRow], catalog: Optional[Catalog]) -> PageCheck:
    """Everything that must be true before the first line is typed."""
    problems, warnings = [], []
    if catalog is not None and info.promotion and catalog.program.lower() not in info.promotion.lower():
        problems.append(f"The page is for '{info.promotion}', but the tire list is for '{catalog.program}'. "
                        "Open the right program's claim page, or load the matching tire list.")
    start, end = info.window
    if start and end:
        outside = [r for r in rows if not start <= r.sale_date <= end]
        if outside:
            problems.append(f"{len(outside)} line(s) have a sale date outside the page's dates "
                            f"({format_page_date(start)} to {format_page_date(end)}), "
                            f"for example invoice {outside[0].invoice}.")
    else:
        warnings.append("Could not read the page's program dates, so the dates were not checked.")
    options = set(info.options)
    missing = sorted({r.product_text for r in rows if r.product_text not in options})
    if missing:
        problems.append("Not in the website's product list: " + "; ".join(missing[:4])
                        + (" ..." if len(missing) > 4 else "") + " (is the tire list out of date?)")
    if info.rows:
        warnings.append(f"The page already lists {len(info.rows)} sale(s). Lines that match are skipped.")
    return PageCheck(not problems, problems, warnings)


# ---------------------------------------------------------------------- running
class RunControl:
    """Pause and stop switches, checked between lines (never in the middle of one)."""

    def __init__(self):
        self._stop = threading.Event()
        self._running = threading.Event()
        self._running.set()

    def pause(self) -> None:
        self._running.clear()

    def resume(self) -> None:
        self._running.set()

    def stop(self) -> None:
        self._stop.set()
        self._running.set()  # let a paused run notice the stop

    @property
    def stopped(self) -> bool:
        return self._stop.is_set()

    @property
    def paused(self) -> bool:
        return not self._running.is_set()

    def checkpoint(self) -> None:
        while not self._running.is_set() and not self._stop.is_set():
            time.sleep(0.1)


@dataclass
class RunSummary:
    entered: list[ClaimRow] = field(default_factory=list)
    already_there: list[ClaimRow] = field(default_factory=list)
    failed: list[tuple[ClaimRow, str]] = field(default_factory=list)
    uploaded: list[tuple[str, str]] = field(default_factory=list)       # (invoice, file name)
    upload_failed: list[tuple[str, str, str]] = field(default_factory=list)  # (invoice, file, why)
    stopped: bool = False

    @property
    def total_qty_entered(self) -> int:
        return sum(r.qty for r in self.entered)

    def lines(self, show_qty: bool = True) -> list[str]:
        qty = f", qty {self.total_qty_entered}" if show_qty else ""
        out = [f"Entered:           {len(self.entered)} lines{qty}",
               f"Already on page:   {len(self.already_there)}",
               f"Failed:            {len(self.failed)}",
               f"PDFs uploaded:     {len(self.uploaded)}",
               f"Uploads failed:    {len(self.upload_failed)}"]
        if self.stopped:
            out.append("The run was stopped before it finished.")
        return out

    def apply_to(self, rows: list[ClaimRow]) -> list[ClaimRow]:
        """Copies of the rows with the outcome in their status (entered / failed)."""
        entered = {(r.invoice, r.product_text) for r in self.entered + self.already_there}
        failed = {(r.invoice, r.product_text): why for r, why in self.failed}
        out = []
        for row in rows:
            row = ClaimRow(**{**row.__dict__, "notes": list(row.notes)})
            key = (row.invoice, row.product_text)
            if key in failed:
                row.status = "failed"
                row.notes.append("failed: " + failed[key])
            elif key in entered:
                row.status = "entered"
            out.append(row)
        return out


Emit = Callable[[dict], None]


class Filler:
    def __init__(self, claim: ClaimPage, state: State, control: Optional[RunControl] = None,
                 emit: Optional[Emit] = None, snapshot_dir: Optional[Path] = None):
        self.claim, self.state = claim, state
        self.control = control or RunControl()
        self.emit = emit or (lambda _event: None)
        self.snapshot_dir = snapshot_dir or paths.output_dir()
        self._all_rows: list[ClaimRow] = []

    def _log(self, message: str, **extra) -> None:
        self.emit({"type": "log", "message": message, **extra})

    def run(self, rows: list[ClaimRow]) -> RunSummary:
        self._all_rows = rows
        summary = RunSummary()
        groups: dict[str, list[ClaimRow]] = {}
        for row in rows:
            groups.setdefault(row.invoice, []).append(row)
        total, done = len(rows), 0
        self.emit({"type": "progress", "done": 0, "total": total})
        if rows and not any(r.pdf_path for r in rows):
            self._log("No invoice PDFs were given, so only the sales are entered. "
                      "Upload the PDFs yourself on the website.")

        for invoice, group in groups.items():
            entered_here = False
            for row in group:
                self.control.checkpoint()
                if self.control.stopped:
                    summary.stopped = True
                    break
                self.emit({"type": "now", "row": row})
                outcome = self._enter(row, summary)
                entered_here = entered_here or outcome
                done += 1
                self.emit({"type": "progress", "done": done, "total": total})
            if summary.stopped:
                # a half-finished invoice still gets its PDF if something of it was entered
                if entered_here:
                    self._upload(invoice, group, summary)
                break
            if entered_here:
                self.control.checkpoint()
                self._upload(invoice, group, summary)

        self.claim.scroll_top()
        self.emit({"type": "finished", "summary": summary})
        return summary

    # ------------------------------------------------------------- one line
    def _enter(self, row: ClaimRow, summary: RunSummary) -> bool:
        """Enter one line. Returns True when it is on the page afterwards."""
        label = f"{row.invoice}  {row.product_text}  x{row.qty}"
        existing = [r for r in self.claim.grid_rows() if r.key == (row.sale_date, row.invoice, row.product_text)]
        if existing:
            if any(r.qty == row.qty for r in existing):
                self.state.mark_entered(row.invoice, row.product_text, row.qty, row.sale_date_str)
                self.state.save()
                summary.already_there.append(row)
                self._log(f"{label}  already on the page, skipped", row=row, status="skipped")
                return True
            why = f"the page already has this line with quantity {existing[0].qty}, the report says {row.qty}"
            summary.failed.append((row, why))
            self._log(f"{label}  NOT entered: {why}", row=row, status="failed")
            return False

        last = ""
        for attempt in (1, 2):
            try:
                result = self.claim.add_row(row)
            except FillError as exc:
                result = AddResult("rejected", str(exc))
            if result.ok:
                self.state.mark_entered(row.invoice, row.product_text, row.qty, row.sale_date_str)
                self.state.save()
                summary.entered.append(row)
                self._log(f"{label}  added, verified", row=row, status="entered")
                return True
            last = result.message or result.outcome
            if result.outcome == "duplicate":
                self.claim.cancel_duplicate()
                last = "the page says it was already entered (duplicate), left alone"
                break
            if result.outcome == "rejected":
                try:
                    self.claim.dismiss_validation()
                except Exception:
                    pass
            if attempt == 1:
                self._log(f"{label}  retrying once ({last})")
        self._snapshot(row)
        summary.failed.append((row, last))
        self._log(f"{label}  FAILED: {last}", row=row, status="failed")
        return False

    # ---------------------------------------------------------------- upload
    def _upload(self, invoice: str, group: list[ClaimRow], summary: RunSummary) -> None:
        pdf = next((r.pdf_path for r in group if r.pdf_path), None)
        if not pdf:
            if any(r.pdf_path for r in self._all_rows):
                self._log(f"{invoice}  no PDF to upload")  # others have one, so say which has none
            return
        name = Path(pdf).name
        try:
            digest = file_hash(pdf)
            if self.state.is_uploaded(digest):
                self._log(f"{invoice}  {name}  already uploaded earlier, skipped", status="skipped")
                return
            self.claim.upload(pdf)
        except Exception as exc:  # a failed upload is reported, and the run goes on
            summary.upload_failed.append((invoice, name, str(exc)))
            self._log(f"{invoice}  {name}  UPLOAD FAILED: {exc}", status="failed")
            return
        self.state.mark_uploaded(digest, name, invoice)
        self.state.save()
        summary.uploaded.append((invoice, name))
        self._log(f"{invoice}  uploaded {name}", status="uploaded")

    def _snapshot(self, row: ClaimRow) -> None:
        """A picture of the page when a line fails, to make a problem easy to explain."""
        try:
            self.snapshot_dir.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            self.claim.page.screenshot(path=str(self.snapshot_dir / f"failure_{row.invoice}_{stamp}.png"))
        except Exception:
            pass
