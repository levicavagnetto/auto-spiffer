"""Command line entry point: `python -m auto_spiffer <command>`."""
from __future__ import annotations

import argparse
import sys

from auto_spiffer import __version__, cli_catalog, cli_fill, cli_invoices, cli_match, cli_prepare, paths


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="auto_spiffer", description="Auto Spiffer")
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("paths", help="show (and create) the folders the app uses")
    rr = sub.add_parser("read-report", help="read a Material Sales PDF and show its rows")
    rr.add_argument("pdf", help="path to Material-Sales.pdf")
    rr.add_argument("--fallback", action="store_true", help="use the position-based reader instead of tables")
    pt = sub.add_parser("parse-tire", help="take one tire description apart")
    pt.add_argument("description", help="the description text, in quotes")
    pr = sub.add_parser("parse-report", help="take apart every tire row of a Material Sales PDF")
    pr.add_argument("pdf", help="path to Material-Sales.pdf")
    cli_catalog.add_parsers(sub)
    cli_match.add_parsers(sub)
    cli_invoices.add_parsers(sub)
    cli_prepare.add_parsers(sub)
    cli_fill.add_parsers(sub)
    sub.add_parser("gui", help="open the window")
    return parser


def cmd_paths() -> int:
    print(f"App folder:     {paths.app_dir()}")
    for folder in paths.ensure_dirs():
        print(f"{folder.name + ':':<15} {folder}  (exists: {folder.exists()})")
    return 0


def _short(text: str, width: int) -> str:
    return text if len(text) <= width else text[: width - 3] + "..."


def cmd_read_report(pdf: str, use_fallback: bool = False) -> int:
    from auto_spiffer.models import format_page_date
    from auto_spiffer.report_parse import ReportError, parse_report

    try:
        report = parse_report(pdf, use_fallback=use_fallback)
    except ReportError as exc:
        print(f"Error: {exc}")
        return 1

    start = format_page_date(report.period_start) if report.period_start else "?"
    end = format_page_date(report.period_end) if report.period_end else "?"
    print(f"Report:   {report.path.name}")
    print(f"Period:   {start} to {end}")
    print(f"Location: {report.location or '?'}")
    print()
    print(f"{'#':>3}  {'Date':<10}  {'Invoice':<7}  {'Qty':>3}  {'Kind':<28}  Description")
    for i, row in enumerate(report.rows, start=1):
        kind = "tire" if row.is_tire else f"ignored ({row.ignored_reason})"
        print(f"{i:>3}  {format_page_date(row.sale_date)}  {row.invoice:<7}  {row.qty:>3}  "
              f"{kind:<28}  {_short(row.description, 60)}")
    print()
    print(f"Rows read:       {len(report.rows)}")
    print(f"Tire rows:       {len(report.tire_rows)}")
    print(f"Ignored rows:    {len(report.ignored_rows)}")
    print(f"Total tire qty:  {report.total_tire_qty}")
    for warning in report.warnings:
        print(f"Warning: {warning}")
    return 0


def _brand_text(spec) -> str:
    if spec.brand:
        suffix = "" if spec.brand.on_claimform else "  (not on the ClaimForm)"
        return f"{spec.brand_code} -> {spec.brand.name}{suffix}"
    if spec.brand_candidates:
        return "ambiguous: " + " or ".join(b.name for b in spec.brand_candidates)
    return "unknown"


def _join(values) -> str:
    return ", ".join(values) if values else "-"


def cmd_parse_tire(description: str) -> int:
    from auto_spiffer.tirespec import parse_tire

    spec = parse_tire(description)
    print(f"Description: {spec.raw}")
    print(f"Sizes:       {_join(spec.sizes)}")
    print(f"Load/speed:  {_join(spec.load_speed)}")
    print(f"Warranty:    {_join(spec.warranties)}")
    print(f"Noise:       {_join(spec.noise)}")
    print(f"Brand:       {_brand_text(spec)}")
    print(f"Words:       {_join(spec.words)}")
    for note in spec.notes:
        print(f"Note:        {note}")
    return 0


def cmd_parse_report(pdf: str) -> int:
    from auto_spiffer.report_parse import ReportError, parse_report
    from auto_spiffer.sizes import has_tire_size
    from auto_spiffer.tirespec import parse_tire

    try:
        report = parse_report(pdf)
    except ReportError as exc:
        print(f"Error: {exc}")
        return 1

    print(f"{'#':>3}  {'Invoice':<7}  {'Brand':<44}  Model words")
    unknown, leftovers = 0, 0
    for i, row in enumerate(report.tire_rows, start=1):
        spec = parse_tire(row.description)
        if spec.brand is None:
            unknown += 1
        if has_tire_size(" ".join(spec.words)):
            leftovers += 1
        print(f"{i:>3}  {row.invoice:<7}  {_brand_text(spec):<44}  {' '.join(spec.words)}")
        for note in spec.notes:
            print(f"{'':>3}  {'':<7}  note: {note}")
    print()
    print(f"Tire rows:                  {len(report.tire_rows)}")
    print(f"Rows with no brand found:   {unknown}")
    print(f"Rows with a size left over: {leftovers}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "paths":
        return cmd_paths()
    if args.command == "read-report":
        return cmd_read_report(args.pdf, args.fallback)
    if args.command == "parse-tire":
        return cmd_parse_tire(args.description)
    if args.command == "parse-report":
        return cmd_parse_report(args.pdf)
    if args.command in cli_catalog.COMMANDS:
        return cli_catalog.run(args)
    if args.command in cli_match.COMMANDS:
        return cli_match.run(args)
    if args.command in cli_invoices.COMMANDS:
        return cli_invoices.run(args)
    if args.command in cli_prepare.COMMANDS:
        return cli_prepare.run(args)
    if args.command in cli_fill.COMMANDS:
        return cli_fill.run(args)
    if args.command == "gui":
        from auto_spiffer.gui.app import run  # the window is only loaded when asked for
        return run()
    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
