"""Command line commands for matching: match-tire, match-report, resolve."""
from __future__ import annotations

from typing import Optional

from rapidfuzz import process

from auto_spiffer.catalog import Catalog, CatalogError, load_catalog
from auto_spiffer.catalog_import import parse_claimform
from auto_spiffer.invoices import InvoiceError, index_folder, link_invoices
from auto_spiffer.match import ATTENTION, NOT_ELIGIBLE, READY, MatchResult, match_tire
from auto_spiffer.models import format_page_date
from auto_spiffer.product_map import ProductMap
from auto_spiffer.report_match import MatchedRow, match_report, merge_rows
from auto_spiffer.report_parse import ReportError, parse_report
from auto_spiffer.tirespec import parse_tire

COMMANDS = ("match-tire", "match-report", "resolve")
LABELS = {READY: "READY", ATTENTION: "NEEDS ATTENTION", NOT_ELIGIBLE: "NOT ELIGIBLE"}


def add_parsers(sub) -> None:
    source = "use this ClaimForm.pdf instead of the saved tire list"
    mt = sub.add_parser("match-tire", help="match one report description to a tire on the list")
    mt.add_argument("description", help="the report description, in quotes")
    mt.add_argument("--claimform", help=source)
    mt.add_argument("--no-saved", action="store_true", help="ignore saved choices")
    mr = sub.add_parser("match-report", help="match every tire row of a Material Sales PDF")
    mr.add_argument("pdf", help="path to Material-Sales.pdf")
    mr.add_argument("--claimform", help=source)
    mr.add_argument("--no-saved", action="store_true", help="ignore saved choices")
    mr.add_argument("--invoices", help="folder with the invoice PDFs, to link each sale to its PDF")
    rs = sub.add_parser("resolve", help="save your choice for a report wording")
    rs.add_argument("description", help="the report description, in quotes")
    group = rs.add_mutually_exclusive_group(required=True)
    group.add_argument("--tire", help="the exact tire name from the tire list")
    group.add_argument("--skip", action="store_true", help="mark this wording as not eligible")
    group.add_argument("--forget", action="store_true", help="remove the saved choice")
    rs.add_argument("--claimform", help=source)


def run(args) -> int:
    try:
        if args.command == "match-tire":
            return cmd_match_tire(args)
        if args.command == "match-report":
            return cmd_match_report(args)
        return cmd_resolve(args)
    except (CatalogError, ReportError, InvoiceError) as exc:
        print(f"Error: {exc}")
        return 1


# --------------------------------------------------------------------- helpers
def load_catalog_for_cli(args) -> Optional[Catalog]:
    if getattr(args, "claimform", None):
        return parse_claimform(args.claimform).catalog
    catalog = load_catalog()
    if catalog is None:
        print("No tire list has been saved yet. Run: catalog-import <ClaimForm.pdf> --save")
        print("(or add --claimform <ClaimForm.pdf> to use a file directly)")
    return catalog


def _short(text: str, width: int) -> str:
    return text if len(text) <= width else text[: width - 3] + "..."


def _print_result(result: MatchResult) -> None:
    how = f" ({result.tier}{f', score {result.score:.0f}' if result.tier == 'tokens' else ''})" if result.tier else ""
    print(f"Result:      {LABELS[result.status]}{how}")
    if result.item and result.status == READY:
        print(f"Tire:        {result.item.site_text}")
    elif result.item:
        print(f"Best guess:  {result.item.site_text}")
    if result.reason:
        print(f"Why:         {result.reason}")
    if result.status != READY and result.candidates:
        print("Suggestions:")
        for n, (item, score) in enumerate(result.candidates, start=1):
            print(f"  {n}. {item.site_text}  ({score:.0f})")
    for note in result.notes:
        print(f"Note:        {note}")


# -------------------------------------------------------------------- match-tire
def cmd_match_tire(args) -> int:
    catalog = load_catalog_for_cli(args)
    if catalog is None:
        return 1
    product_map = None if args.no_saved else ProductMap.load()
    spec = parse_tire(args.description)
    print(f"Description: {spec.raw}")
    brand = f"{spec.brand_code} -> {spec.brand.name}" if spec.brand else "unknown"
    print(f"Brand:       {brand}")
    print(f"Words:       {', '.join(spec.words) or '-'}")
    _print_result(match_tire(spec, catalog, product_map))
    return 0


# ------------------------------------------------------------------ match-report
def cmd_match_report(args) -> int:
    catalog = load_catalog_for_cli(args)
    if catalog is None:
        return 1
    report = parse_report(args.pdf)
    product_map = None if args.no_saved else ProductMap.load()
    if product_map is not None and product_map.sync(catalog):
        product_map.save()

    unmerged = match_report(report, catalog, product_map=product_map)
    rows = merge_rows(unmerged)

    links = None
    if args.invoices:
        index = index_folder(args.invoices)
        links = link_invoices(rows, index, {r.invoice for r in report.rows})

    print(f"Tire list:  {catalog.program}")
    print(f"Report:     {report.path.name}")
    if links is not None:
        print(f"Invoices:   {len(index.pdfs)} PDFs for {len(index.by_invoice)} invoice numbers in {args.invoices}")
    print()
    pdf_head = f"{'PDF':<7}  " if links is not None else ""
    print(f"{'#':>3}  {'Date':<10}  {'Invoice':<7}  {'Qty':>4}  {'Status':<15}  {pdf_head}"
          f"{'Matched tire / best guess':<54}  How")
    for n, m in enumerate(rows, start=1):
        r = m.result
        qty = f"{m.qty}{'*' if m.merged else ''}"
        tire = r.item.site_text if r.item else "-"
        how = r.tier + (f" {r.score:.0f}" if r.tier == "tokens" else "") if r.tier else ""
        pdf_cell = ""
        if links is not None:
            pdf_cell = f"{('yes' if m.pdf else 'NO PDF') if m.status != NOT_ELIGIBLE else '-':<7}  "
        print(f"{n:>3}  {format_page_date(m.sale_date)}  {m.invoice:<7}  {qty:>4}  "
              f"{LABELS[m.status]:<15}  {pdf_cell}{_short(tire, 54):<54}  {how}")

    attention = [m for m in rows if m.status == ATTENTION]
    if attention:
        print()
        print("Needs attention (these are NOT entered until you resolve them):")
        for m in attention:
            print(f"  {m.invoice}  {m.description}")
            print(f"      why: {m.result.reason}")
            for k, (item, score) in enumerate(m.result.candidates, start=1):
                print(f"      {k}. {item.site_text}  ({score:.0f})")

    not_eligible = [m for m in rows if m.status == NOT_ELIGIBLE]
    if not_eligible:
        print()
        print("Not eligible:")
        for m in not_eligible:
            print(f"  {m.invoice}  {_short(m.description, 56):<56}  {m.result.reason}")

    def count(status):
        chosen = [m for m in rows if m.status == status]
        return len(chosen), sum(m.qty for m in chosen)

    print()
    print(f"Report rows:      {len(unmerged)}  ->  {len(rows)} after merging split quantities "
          f"({len(unmerged) - len(rows)} merged, marked *)")
    for status, label in ((READY, "Ready"), (ATTENTION, "Needs attention"), (NOT_ELIGIBLE, "Not eligible")):
        rows_n, qty_n = count(status)
        print(f"{label + ':':<17} {rows_n:>2} rows, qty {qty_n}")
    print(f"Total qty:        {sum(m.qty for m in rows)}")

    if links is not None:
        print()
        print(f"Missing invoice PDFs: {len(links.missing)}  (sales to claim that have no PDF; they will not be entered)")
        if links.missing:
            print("  " + ", ".join(links.missing))
        print(f"Unused PDFs:          {len(links.unused)}  (invoice number is not in the report at all)")
        for pdf in links.unused:
            print(f"  {pdf.path.name}  (invoice {pdf.invoice})")
        print(f"Not needed PDFs:      {len(links.unneeded)}  (sales that are not eligible)")
        for pdf in links.unneeded:
            print(f"  {pdf.path.name}  (invoice {pdf.invoice})")
        for pdf in index.pdfs:
            for warning in pdf.warnings:
                print(f"Warning: {pdf.path.name}: {warning}")
        for path, message in index.problems:
            print(f"Warning: {path.name}: {message}")
        for warning in links.warnings:
            print(f"Cross-check: {warning}")
    return 0


# ----------------------------------------------------------------------- resolve
def cmd_resolve(args) -> int:
    catalog = load_catalog_for_cli(args)
    if catalog is None:
        return 1
    spec = parse_tire(args.description)
    product_map = ProductMap.load()

    if args.forget:
        if product_map.forget(spec):
            product_map.save()
            print("Removed the saved choice for this wording.")
        else:
            print("There was no saved choice for this wording.")
        return 0

    if args.skip:
        product_map.remember(spec, None)
        product_map.save()
        print(f"Saved: this wording is not eligible.  ({spec.raw})")
        return 0

    item = catalog.find_by_text(args.tire)
    if item is None:
        print(f"Error: that tire is not on the tire list: {args.tire}")
        close = process.extract(args.tire, [t.site_text for t in catalog.tires], limit=3)
        for text, _, _ in close:
            print(f"  did you mean: {text}")
        return 1
    product_map.remember(spec, item.id)
    product_map.save()
    print(f"Saved: this wording is {item.site_text}")
    print(f"       ({spec.raw})")
    print(f"File:  {product_map.path}")
    return 0
