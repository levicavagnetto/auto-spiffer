"""Command line commands for the browser step: probe-page, fill-one, fill-all.

Without --live these run in TEST MODE: the saved copy of the claim page is opened, every web
request is blocked (nothing can reach the real website), and a small stub plays the part of the
server for Add and for uploads. Test mode keeps its own record of what it "entered"
(data/state_test.json), so it never makes the real run think something was already entered.
With --live the real site is opened, you log in and go to the claim page, and the same steps run for real.
"""
from __future__ import annotations

import time
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from typing import Optional

from auto_spiffer import paths
from auto_spiffer.browser import BrowserSession
from auto_spiffer.catalog import CatalogError
from auto_spiffer.cli_match import load_catalog_for_cli
from auto_spiffer.fill import (ClaimPage, FillError, Filler, REQUIRED, check_page, load_config)
from auto_spiffer.invoices import InvoiceError
from auto_spiffer.models import ClaimRow, format_page_date
from auto_spiffer.pipeline import prepare
from auto_spiffer.product_map import ProductMap
from auto_spiffer.report import write_report_csv
from auto_spiffer.report_parse import ReportError, parse_report
from auto_spiffer.state import State, state_path_for_test_mode

COMMANDS = ("probe-page", "fill-one", "fill-all")


def add_parsers(sub) -> None:
    def common(p):
        p.add_argument("--live", action="store_true",
                       help="use the real website (default: test mode on the saved page)")
        p.add_argument("--headless", action="store_true", help="do not show the browser (test mode only)")
        p.add_argument("--hold", type=float, default=None,
                       help="seconds to keep the test browser open at the end (default 5 when shown)")

    pp = sub.add_parser("probe-page", help="open the claim page and check that every field is found")
    common(pp)
    fo = sub.add_parser("fill-one", help="enter one line on the claim page")
    fo.add_argument("--date", required=True, help="sale date, mm/dd/yyyy")
    fo.add_argument("--invoice", required=True)
    fo.add_argument("--tire", required=True, help="the exact tire name from the tire list")
    fo.add_argument("--qty", type=int, required=True)
    common(fo)
    fa = sub.add_parser("fill-all", help="enter every ready sale of a report, and upload the invoice PDFs")
    fa.add_argument("report", help="path to Material-Sales.pdf")
    fa.add_argument("--invoices", help="folder with the invoice PDFs")
    fa.add_argument("--claimform", help="use this ClaimForm.pdf instead of the saved tire list")
    fa.add_argument("--no-saved", action="store_true", help="ignore saved choices")
    fa.add_argument("--ignore-program-mismatch", action="store_true",
                    help="only for trying things out: do not stop when the months do not match")
    fa.add_argument("--limit", type=int, default=0, help="only the first N lines (for a first trial)")
    fa.add_argument("--fresh", action="store_true", help="test mode: forget what an earlier test run entered")
    fa.add_argument("--allow-missing-pdf", action="store_true")
    common(fa)


def run(args) -> int:
    try:
        if args.command == "probe-page":
            return cmd_probe(args)
        if args.command == "fill-one":
            return cmd_fill_one(args)
        return cmd_fill_all(args)
    except (FillError, CatalogError, ReportError, InvoiceError) as exc:
        print(f"Error: {exc}")
        return 1


# ---------------------------------------------------------------------- session
def _banner(live: bool) -> None:
    if live:
        print("Mode: LIVE. This is the real website.")
    else:
        print("Mode: TEST. The saved page is used and nothing can reach the real website.")


def _open(args, window: Optional[tuple[str, str]] = None) -> BrowserSession:
    cfg = load_config()
    session = BrowserSession(cfg, test_mode=not args.live, headless=args.headless and not args.live,
                             test_window=window).start()
    if args.live:
        print(f"A browser opened at {cfg.live_url}")
        print("Log in, then go to Claims > Submit a Sales Claim for the right program.")
        input("When the claim form is showing, press Enter here... ")
    return session


def _hold(args, session: BrowserSession) -> None:
    if args.live:
        input("Review the page in the browser. Press Enter here to close the browser "
              "(after you have submitted the claim yourself)... ")
    elif not args.headless:
        time.sleep(5 if args.hold is None else args.hold)


# -------------------------------------------------------------------- probe-page
def cmd_probe(args) -> int:
    _banner(args.live)
    session = _open(args)
    try:
        def job(sess: BrowserSession):
            claim = ClaimPage.find(sess.context, sess.cfg) or ClaimPage(sess.page, sess.cfg)
            return claim.read_info(), claim.page.url, claim.page.evaluate(
                """() => ({
                    jquery: typeof window.jQuery === 'function',
                    chosen: !!(window.jQuery && window.jQuery('.chosen-select').data('chosen')),
                    ajax: typeof Sys !== 'undefined' && !!Sys.WebForms,
                    telerik: typeof $find === 'function' &&
                             !!$find('ctl00_DefaultContent_InvoiceDateRadDatePicker')
                })""")

        info, url, scripts = session.call(job)
        cfg = session.cfg
        print(f"Page:   {url}")
        print()
        print(f"{'Field':<18} {'Found':<8} Selector")
        missing = []
        for key, selector in cfg.selectors.items():
            n = info.counts.get(key, 0)
            tag = "found" if n else "MISSING"
            if not n and key in REQUIRED:
                missing.append(key)
            note = f"  ({n} matches, the first is used)" if n > 1 else ""
            print(f"{key:<18} {tag:<8} {selector}{note}")
        print()
        start, end = info.window
        print(f"Promotion:           {info.promotion or '(not found)'}")
        print(f"Page date window:    {format_page_date(start) if start else '?'} to "
              f"{format_page_date(end) if end else '?'}")
        print(f"Products in list:    {len(info.options)}")
        print(f"Sales already listed: {len(info.rows)}")
        print(f"Page scripts:        jQuery {'yes' if scripts['jquery'] else 'NO'}, "
              f"dropdown {'yes' if scripts['chosen'] else 'NO'}, "
              f"ASP.NET AJAX {'yes' if scripts['ajax'] else 'NO'}, "
              f"Telerik date box {'yes' if scripts['telerik'] else 'no'}")
        print()
        if missing:
            print("NOT the claim page, or a field moved: " + ", ".join(missing))
            return 1
        print("All the fields needed to enter sales were found.")
        _hold(args, session)
        return 0
    finally:
        session.close()


# --------------------------------------------------------------------- fill-one
def cmd_fill_one(args) -> int:
    _banner(args.live)
    try:
        when = datetime.strptime(args.date, "%m/%d/%Y").date()
    except ValueError:
        print("Error: type the date as mm/dd/yyyy, for example 09/05/2026.")
        return 1
    row = ClaimRow(sale_date=when, invoice=args.invoice, product_text=args.tire, qty=args.qty)
    session = _open(args, window=(args.date, args.date))
    try:
        def job(sess: BrowserSession):
            claim = sess.claim_page()
            result = claim.add_row(row)
            if result.outcome == "duplicate":
                claim.cancel_duplicate()
            elif result.outcome == "rejected":
                claim.dismiss_validation()
            return result, claim.grid_rows()

        try:
            result, rows = session.call(job)
        except FillError as exc:
            print(f"NOT added: {exc}")
            return 1
        if result.ok:
            print(f"{row.invoice}  {row.product_text}  x{row.qty}  added, verified")
            print(f"The page now lists {len(rows)} sale(s).")
            _hold(args, session)
            return 0
        print(f"NOT added ({result.outcome}): {result.message}")
        return 1
    finally:
        session.close()


# --------------------------------------------------------------------- fill-all
def _state_path_for_test_mode() -> Path:
    return state_path_for_test_mode()


def cmd_fill_all(args) -> int:
    _banner(args.live)
    catalog = load_catalog_for_cli(args)
    if catalog is None:
        return 1
    report = parse_report(args.report)
    product_map = None if args.no_saved else ProductMap.load()
    if product_map is not None and product_map.sync(catalog):
        product_map.save()

    state_path = None if args.live else _state_path_for_test_mode()
    if state_path and args.fresh and state_path.exists():
        state_path.unlink()
    state = State.load(state_path)
    if not args.live:
        print(f"(test mode keeps its own record in {state_path.name}; --fresh clears it)")

    result = prepare(report, catalog, invoices_folder=args.invoices, product_map=product_map, state=state,
                     ignore_program_mismatch=args.ignore_program_mismatch,
                     allow_missing_pdf=args.allow_missing_pdf)
    if result.blocked:
        print(f"STOPPED: {result.program_check.message}")
        return 1
    rows = result.to_enter[: args.limit] if args.limit else result.to_enter
    if not rows:
        print("Nothing is ready to enter.")
        held = len(result.with_status("attention"))
        if held:
            print(f"{held} line(s) need your decision first (use 'resolve', or the window).")
        return 0
    print(f"Will enter {len(rows)} line(s), qty {sum(r.qty for r in rows)}"
          + (f" (limited to the first {args.limit})" if args.limit else "") + ".")

    dates = [r.sale_date for r in rows]
    window = (format_page_date(min(dates)), format_page_date(max(dates)))
    session = _open(args, window=window)
    try:
        def job(sess: BrowserSession):
            claim = sess.claim_page()
            check = check_page(claim.read_info(), rows, catalog)
            for warning in check.warnings:
                print(f"Warning: {warning}")
            if not check.ok:
                return check, None
            print("Page check passed. Entering...")
            filler = Filler(claim, state, emit=lambda e: print("  " + e["message"], flush=True)
                            if e["type"] == "log" else None)
            return check, filler.run(rows)

        check, summary = session.call(job)
        if summary is None:
            print("STOPPED before entering anything:")
            for problem in check.problems:
                print(f"  - {problem}")
            return 1
        print()
        for line in summary.lines():
            print(line)
        done = replace(result, claim_rows=summary.apply_to(result.claim_rows))
        print(f"Report saved: {write_report_csv(done)}")
        print("Nothing has been submitted. Review the page, then submit it yourself.")
        _hold(args, session)
        return 0 if not summary.failed and not summary.upload_failed else 1
    finally:
        session.close()
