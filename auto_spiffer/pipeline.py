"""Everything that happens before the browser: from a report, a tire list, and the invoice PDFs to the
exact list of lines to enter on the claim page.

    report -> program check -> tire matching -> merge splits -> invoice PDFs -> already-entered check
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Optional

from auto_spiffer.brands import BrandTable
from auto_spiffer.catalog import Catalog
from auto_spiffer.invoices import InvoiceIndex, LinkReport, index_folder, link_invoices
from auto_spiffer.match import ATTENTION, NOT_ELIGIBLE, READY
from auto_spiffer.models import ClaimRow, SaleRow, format_page_date
from auto_spiffer.product_map import ProductMap
from auto_spiffer.report_match import MatchedRow, match_report, merge_rows
from auto_spiffer.report_parse import Report, parse_report
from auto_spiffer.state import State
from auto_spiffer.tirespec import NoiseRules

# ClaimRow statuses
TO_ENTER = "ready"
HELD = "attention"
NOT_ELIGIBLE_ROW = "not_eligible"
PROBLEM = "problem"
ALREADY = "already_entered"


# --------------------------------------------------------------- program check
@dataclass
class ProgramCheck:
    ok: bool
    checked: bool        # False when there was nothing to compare (the tire list has no program dates)
    message: str = ""
    period: tuple[Optional[date], Optional[date]] = (None, None)  # what the report covers
    window: tuple[Optional[date], Optional[date]] = (None, None)  # what the tire list's program covers


def _span(start: Optional[date], end: Optional[date]) -> str:
    return (f"{format_page_date(start) if start else '?'} to {format_page_date(end) if end else '?'}")


def check_program(report: Report, catalog: Catalog) -> ProgramCheck:
    """The report's sales must fall inside the loaded tire list's program dates."""
    dates = [r.sale_date for r in report.rows]
    start = report.period_start or (min(dates) if dates else None)
    end = report.period_end or (max(dates) if dates else None)
    window = (catalog.program_start, catalog.program_end)
    result = ProgramCheck(ok=True, checked=False, period=(start, end), window=window)
    if not (window[0] and window[1] and start and end):
        result.message = "The program dates could not be compared (the tire list or report has no dates)."
        return result
    result.checked = True
    if window[0] <= start and end <= window[1]:
        result.message = f"The report period ({_span(start, end)}) is inside {catalog.program}."
        return result
    result.ok = False
    result.message = (
        f"The report covers {_span(start, end)}, but the loaded tire list is for '{catalog.program}' "
        f"({_span(*window)}). Load the ClaimForm.pdf of the program that covers these sales.")
    return result


# ---------------------------------------------------------------------- result
@dataclass
class PrepareResult:
    report: Report
    catalog: Catalog
    program_check: ProgramCheck
    blocked: bool = False                 # True: stopped by the program check, nothing else was done
    claim_rows: list[ClaimRow] = field(default_factory=list)
    matched: list[MatchedRow] = field(default_factory=list)  # parallel to claim_rows
    ignored: list[SaleRow] = field(default_factory=list)     # shipping, tubes, ...
    index: Optional[InvoiceIndex] = None
    links: Optional[LinkReport] = None
    warnings: list[str] = field(default_factory=list)

    def with_status(self, status: str) -> list[ClaimRow]:
        return [r for r in self.claim_rows if r.status == status]

    @property
    def to_enter(self) -> list[ClaimRow]:
        return self.with_status(TO_ENTER)

    @property
    def qty_to_enter(self) -> int:
        return sum(r.qty for r in self.to_enter)

    @property
    def payout_to_enter(self) -> float:
        return sum(r.estimated_payout for r in self.to_enter)


# --------------------------------------------------------------------- prepare
def prepare(report: Report, catalog: Catalog, *, invoices_folder: Optional[str | Path] = None,
            index: Optional[InvoiceIndex] = None, brands: Optional[BrandTable] = None, noise: Optional[NoiseRules] = None,
            product_map: Optional[ProductMap] = None, state: Optional[State] = None,
            ignore_program_mismatch: bool = False, allow_missing_pdf: bool = False) -> PrepareResult:
    """Build the lines to enter. Nothing here touches the website.

    Invoice PDFs come from `invoices_folder`, or from a ready-made `index` (so the window does not
    have to re-read every PDF each time a decision changes).
    """
    check = check_program(report, catalog)
    result = PrepareResult(report=report, catalog=catalog, program_check=check)
    result.warnings.extend(report.warnings)
    if not check.ok and not ignore_program_mismatch:
        result.blocked = True
        return result
    if not check.ok:
        result.warnings.append(
            "Program check skipped. " + check.message + " The website will reject sale dates "
            "outside its program window.")

    result.ignored = report.ignored_rows
    result.matched = merge_rows(match_report(report, catalog, brands, noise, product_map))

    have_pdfs = invoices_folder is not None or index is not None
    if have_pdfs:
        result.index = index if index is not None else index_folder(invoices_folder)
        result.links = link_invoices(result.matched, result.index, {r.invoice for r in report.rows})
        result.warnings.extend(result.links.warnings)
        for pdf in result.index.pdfs:
            result.warnings.extend(f"{pdf.path.name}: {w}" for w in pdf.warnings)
        result.warnings.extend(f"{p.name}: {msg}" for p, msg in result.index.problems)

    window = check.window if check.checked and check.ok else (None, None)
    for m in result.matched:
        result.claim_rows.append(
            _claim_row(m, check_pdf=have_pdfs and not allow_missing_pdf,
                       state=state, window=window))
    return result


def _claim_row(m: MatchedRow, *, check_pdf: bool, state: Optional[State],
               window: tuple[Optional[date], Optional[date]]) -> ClaimRow:
    item = m.result.item
    row = ClaimRow(
        sale_date=m.sale_date, invoice=m.invoice, product_text="", qty=m.qty,
        pdf_path=str(m.pdf.path) if m.pdf else None, description=m.description,
        merged_from=len(m.rows), notes=list(m.result.notes))

    if m.status == NOT_ELIGIBLE:
        row.status = NOT_ELIGIBLE_ROW
        row.notes.append(m.result.reason)
        return row
    if m.status == ATTENTION:
        row.status = HELD
        row.notes.append(f"needs attention: {m.result.reason}")
        if item:
            row.notes.append(f"best guess: {item.site_text}")
        return row

    # Ready: a settled tire. Now make sure it is safe to enter.
    assert m.status == READY and item is not None
    row.product_text, row.item_id, row.unit_value = item.site_text, item.id, item.unit_value
    row.model = item.model
    problems = []
    if window[0] and window[1] and not (window[0] <= m.sale_date <= window[1]):
        problems.append(f"sale date {format_page_date(m.sale_date)} is outside the program dates "
                        f"({_span(*window)})")
    if check_pdf and m.pdf is None:
        problems.append("no invoice PDF found for this invoice")
    if state is not None:
        earlier = state.find_entered(m.invoice, item.site_text)
        if earlier is not None:
            if earlier.qty == m.qty or earlier.product == "*":
                row.status = ALREADY
                row.notes.append(f"already entered on {earlier.entered_on[:10]}")
                return row
            problems.append(f"already entered with qty {earlier.qty}, the report now says {m.qty}")
    if problems:
        row.status = PROBLEM
        row.notes.extend(problems)
    return row
