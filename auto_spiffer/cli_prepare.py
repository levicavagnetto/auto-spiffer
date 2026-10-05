"""Command line commands for the claim pipeline: prepare, and the state-* test commands."""
from __future__ import annotations

from pathlib import Path

from auto_spiffer.catalog import CatalogError
from auto_spiffer.cli_match import load_catalog_for_cli
from auto_spiffer.invoices import InvoiceError
from auto_spiffer.models import format_page_date
from auto_spiffer.pipeline import (ALREADY, HELD, NOT_ELIGIBLE_ROW, PROBLEM, TO_ENTER, prepare)
from auto_spiffer.product_map import ProductMap
from auto_spiffer.report import STATUS_LABELS, summary_lines, write_report_csv
from auto_spiffer.report_parse import ReportError, parse_report
from auto_spiffer.state import ANY_PRODUCT, State

COMMANDS = ("prepare", "state-show", "state-mark", "state-forget")


def add_parsers(sub) -> None:
    pp = sub.add_parser("prepare", help="work out exactly what would be entered (opens no browser)")
    pp.add_argument("report", help="path to Material-Sales.pdf")
    pp.add_argument("--invoices", help="folder with the invoice PDFs")
    pp.add_argument("--claimform", help="use this ClaimForm.pdf instead of the saved tire list")
    pp.add_argument("--no-saved", action="store_true", help="ignore saved choices")
    pp.add_argument("--ignore-program-mismatch", action="store_true",
                    help="only for trying things out: do not stop when the months do not match")
    pp.add_argument("--allow-missing-pdf", action="store_true",
                    help="treat sales with no invoice PDF as ready anyway")
    pp.add_argument("--no-csv", action="store_true", help="do not write the CSV report")
    sub.add_parser("state-show", help="show what is recorded as entered and uploaded")
    sm = sub.add_parser("state-mark", help="(for testing) record an invoice as already entered")
    sm.add_argument("invoice", help="invoice number")
    sm.add_argument("--product", default=ANY_PRODUCT, help="exact tire name (default: any tire)")
    sm.add_argument("--qty", type=int, default=0)
    sf = sub.add_parser("state-forget", help="remove the records for an invoice")
    sf.add_argument("invoice", help="invoice number")


def run(args) -> int:
    try:
        if args.command == "prepare":
            return cmd_prepare(args)
        if args.command == "state-show":
            return cmd_state_show()
        if args.command == "state-mark":
            return cmd_state_mark(args)
        return cmd_state_forget(args)
    except (CatalogError, ReportError, InvoiceError) as exc:
        print(f"Error: {exc}")
        return 1


def _short(text: str, width: int) -> str:
    return text if len(text) <= width else text[: width - 3] + "..."


def cmd_prepare(args) -> int:
    catalog = load_catalog_for_cli(args)
    if catalog is None:
        return 1
    report = parse_report(args.report)
    product_map = None if args.no_saved else ProductMap.load()
    if product_map is not None and product_map.sync(catalog):
        product_map.save()

    result = prepare(report, catalog, invoices_folder=args.invoices, product_map=product_map,
                     state=State.load(), ignore_program_mismatch=args.ignore_program_mismatch,
                     allow_missing_pdf=args.allow_missing_pdf)

    if result.blocked:
        print(f"STOPPED: {result.program_check.message}")
        print("Nothing was prepared. (--ignore-program-mismatch exists only for trying things out; "
              "the website rejects sale dates outside its program window.)")
        return 1

    print(f"Program check: {'OK' if result.program_check.ok else 'SKIPPED'}  -  {result.program_check.message}")
    print()
    print(f"{'#':>3}  {'Date':<10}  {'Invoice':<7}  {'Qty':>4}  {'Status':<15}  {'PDF':<10}  Product / note")
    for n, r in enumerate(result.claim_rows, start=1):
        qty = f"{r.qty}{'*' if r.merged_from > 1 else ''}"
        if r.pdf_path:
            pdf = "yes"
        elif r.status == NOT_ELIGIBLE_ROW:
            pdf = "-"
        else:
            pdf = "NO PDF" if result.index is not None else "n/a"
        text = r.product_text or "; ".join(r.notes)
        print(f"{n:>3}  {format_page_date(r.sale_date)}  {r.invoice:<7}  {qty:>4}  "
              f"{STATUS_LABELS[r.status].upper():<15}  {pdf:<10}  {_short(text, 70)}")
        if r.product_text and r.status != TO_ENTER:
            print(f"{'':>3}  {'':<10}  {'':<7}  {'':>4}  {'':<15}  {'':<10}  -> {'; '.join(r.notes)}")

    for status, title in ((HELD, "Held back (need your decision)"), (PROBLEM, "Problems (will not be entered)")):
        rows = result.with_status(status)
        if rows:
            print()
            print(f"{title}:")
            for r in rows:
                print(f"  {r.invoice}  {_short(r.description, 50)}")
                for note in r.notes:
                    print(f"      {note}")

    print()
    for line in summary_lines(result):
        print(line)
    if result.links is not None and result.links.missing:
        print("  missing: " + ", ".join(result.links.missing))
    for warning in dict.fromkeys(result.warnings):
        print(f"Warning: {warning}")
    if not args.no_csv:
        print()
        print(f"Report saved: {write_report_csv(result)}")
    return 0


def cmd_state_show() -> int:
    state = State.load()
    print(f"File: {state.path}")
    print(f"Entered: {len(state.entered)}")
    for e in state.entered:
        product = "(any tire)" if e.product == ANY_PRODUCT else e.product
        print(f"  {e.invoice}  {product}  qty {e.qty}  {e.sale_date}  entered {e.entered_on}")
    print(f"Uploaded: {len(state.uploaded)}")
    for u in state.uploaded:
        print(f"  {u.invoice}  {u.file}  {u.file_hash[:12]}...  {u.uploaded_on}")
    return 0


def cmd_state_mark(args) -> int:
    state = State.load()
    state.mark_entered(args.invoice, args.product, args.qty, "")
    state.save()
    what = "any tire" if args.product == ANY_PRODUCT else args.product
    print(f"Recorded invoice {args.invoice} ({what}) as already entered.")
    print("This is for testing. Remove it with: state-forget " + args.invoice)
    return 0


def cmd_state_forget(args) -> int:
    state = State.load()
    removed = state.forget_invoice(args.invoice)
    state.save()
    print(f"Removed {removed} record(s) for invoice {args.invoice}.")
    return 0
