"""Command line commands for invoice PDFs: read-invoice, index-invoices."""
from __future__ import annotations

from auto_spiffer.invoices import InvoiceError, index_folder, read_invoice
from auto_spiffer.models import format_page_date
from auto_spiffer.report_parse import ReportError, parse_report

COMMANDS = ("read-invoice", "index-invoices", "demo-invoices")


def add_parsers(sub) -> None:
    ri = sub.add_parser("read-invoice", help="read one invoice PDF")
    ri.add_argument("pdf", help="path to an invoice PDF")
    ii = sub.add_parser("index-invoices", help="list the invoice numbers of all PDFs in a folder")
    ii.add_argument("folder", help="folder containing the invoice PDFs")
    di = sub.add_parser("demo-invoices",
                        help="(for trying things out) make fake invoice PDFs for a report")
    di.add_argument("report", help="path to Material-Sales.pdf")
    di.add_argument("folder", help="folder to create the fake PDFs in")
    di.add_argument("--count", type=int, default=5, help="how many invoices to make (default 5)")


def run(args) -> int:
    try:
        if args.command == "read-invoice":
            return cmd_read(args.pdf)
        if args.command == "demo-invoices":
            return cmd_demo(args.report, args.folder, args.count)
        return cmd_index(args.folder)
    except (InvoiceError, ReportError) as exc:
        print(f"Error: {exc}")
        return 1


def cmd_demo(report_path: str, folder: str, count: int) -> int:
    from auto_spiffer.demo_pdfs import make_demo_invoices

    for line in make_demo_invoices(parse_report(report_path), folder, count):
        print(line)
    return 0


def cmd_read(pdf: str) -> int:
    info = read_invoice(pdf)
    print(f"File:          {info.path.name}")
    print(f"Invoice #:     {info.invoice or '?'}" + ("  (from the file name)" if info.from_filename else ""))
    print(f"Invoice date:  {format_page_date(info.invoice_date) if info.invoice_date else '?'}")
    print(f"Tire sizes:    {', '.join(info.sizes) or '-'}")
    print(f"File hash:     {info.file_hash[:16]}...")
    for warning in info.warnings:
        print(f"Warning: {warning}")
    return 0


def cmd_index(folder: str) -> int:
    index = index_folder(folder)
    print(f"Folder: {folder}")
    print()
    print(f"{'Invoice #':<10}  {'Date':<10}  {'File':<34}  Notes")
    for number in sorted(index.by_invoice):
        for pos, info in enumerate(index.by_invoice[number]):
            when = format_page_date(info.invoice_date) if info.invoice_date else "?"
            note = "; ".join(info.warnings)
            if pos == 0 and not info.warnings:
                note = ""
            print(f"{number:<10}  {when:<10}  {info.path.name[:34]:<34}  {note}")
    if index.problems:
        print()
        print("Could not use these files:")
        for path, message in index.problems:
            print(f"  {path.name}: {message}")
    if index.skipped:
        print()
        print(f"Ignored (not PDFs): {', '.join(p.name for p in index.skipped)}")
    print()
    print(f"PDFs used:           {len(index.pdfs)}")
    print(f"Invoice numbers:     {len(index.by_invoice)}")
    print(f"Invoices with extra copies: {len(index.duplicates)}")
    print(f"Files with problems: {len(index.problems)}")
    return 0
