"""The run report: a CSV file in output/ and the text summary shown on screen."""
from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path
from typing import Optional

from auto_spiffer import paths
from auto_spiffer.models import format_page_date
from auto_spiffer.pipeline import (ALREADY, HELD, NOT_ELIGIBLE_ROW, PROBLEM, TO_ENTER, PrepareResult)

COLUMNS = ["Status", "Invoice", "Sale Date", "Qty", "Product", "Unit Value", "Est. Payout",
           "Invoice PDF", "Report Rows Merged", "Report Description", "Notes"]

STATUS_LABELS = {
    TO_ENTER: "ready",
    HELD: "needs attention",
    NOT_ELIGIBLE_ROW: "not eligible",
    PROBLEM: "problem",
    ALREADY: "already entered",
    "entered": "entered",
    "failed": "failed",
    "excluded": "excluded",
}


def write_report_csv(result: PrepareResult, folder: Optional[Path] = None,
                     now: Optional[datetime] = None) -> Path:
    """Write output/report_<timestamp>.csv (opens cleanly in Excel). Returns the path."""
    folder = Path(folder) if folder else paths.output_dir()
    folder.mkdir(parents=True, exist_ok=True)
    stamp = (now or datetime.now()).strftime("%Y%m%d-%H%M%S")
    path = folder / f"report_{stamp}.csv"
    counter = 2
    while path.exists():
        path = folder / f"report_{stamp}-{counter}.csv"
        counter += 1

    return write_report_to(result, path)


def write_report_to(result: PrepareResult, path: Path) -> Path:
    """Write the report CSV to an exact path (used by the window's Export button)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(COLUMNS)
        for r in result.claim_rows:
            writer.writerow([
                STATUS_LABELS.get(r.status, r.status), r.invoice, format_page_date(r.sale_date), r.qty,
                r.product_text, f"{r.unit_value:.2f}" if r.unit_value else "",
                f"{r.estimated_payout:.2f}" if r.status == TO_ENTER and r.unit_value else "",
                Path(r.pdf_path).name if r.pdf_path else "", r.merged_from if r.merged_from > 1 else "",
                r.description, "; ".join(r.notes)])
        for s in result.ignored:
            writer.writerow(["ignored", s.invoice, format_page_date(s.sale_date), s.qty, "", "", "",
                             "", "", s.description, s.ignored_reason])
    return path


def summary_lines(result: PrepareResult, show_qty: bool = True) -> list[str]:
    """The totals the person compares against the website before submitting.

    `show_qty=False` leaves out every quantity total (the Run page does not show them).
    """
    rows = result.claim_rows

    def line(label: str, status: str) -> str:
        chosen = result.with_status(status)
        qty = f", qty {sum(r.qty for r in chosen)}" if show_qty else ""
        return f"{label + ':':<20} {len(chosen):>3} rows{qty}"

    lines = [
        f"Report:              {result.report.path.name} "
        f"({format_page_date(result.report.period_start) if result.report.period_start else '?'} to "
        f"{format_page_date(result.report.period_end) if result.report.period_end else '?'})",
        f"Tire list:           {result.catalog.program}",
        f"Report rows:         {len(result.report.rows)} read, {len(result.ignored)} ignored (not tires), "
        f"{len(rows)} lines after merging split quantities",
        "",
        line("To enter", TO_ENTER),
        line("Needs attention", HELD),
        line("Not eligible", NOT_ELIGIBLE_ROW),
        line("Problems", PROBLEM),
        line("Already entered", ALREADY),
    ]
    if result.links is not None:
        lines.append(f"{'Missing invoice PDFs:':<20} {len(result.links.missing)}")
    lines.append("")
    if show_qty:
        lines.append(f"Total qty to enter:  {result.qty_to_enter}")
    lines.append(f"Estimated payout:    ${result.payout_to_enter:.2f}")
    return lines
