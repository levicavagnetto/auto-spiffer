"""Read the Protractor "Material Sales" report (PDF) into sale rows."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import pdfplumber

from auto_spiffer.models import SaleRow
from auto_spiffer.sizes import has_tire_size

HEADER_CELLS = ["invoiced", "invoice #", "description", "quantity"]
_DATE_RE = r"\d{1,2}/\d{1,2}/\d{4}"
_ROW_TOLERANCE = 6.0  # points: how far a cell may sit from the row's date line


class ReportError(Exception):
    """The report could not be read. The message is written for the person using the app."""


@dataclass
class Report:
    path: Path
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    location: Optional[str] = None
    rows: list[SaleRow] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def tire_rows(self) -> list[SaleRow]:
        return [r for r in self.rows if r.is_tire]

    @property
    def ignored_rows(self) -> list[SaleRow]:
        return [r for r in self.rows if not r.is_tire]

    @property
    def total_tire_qty(self) -> int:
        return sum(r.qty for r in self.tire_rows)


# ----------------------------------------------------------------------- helpers
def parse_report_date(text: str) -> date:
    """09/05/2026 or 9/5/2026 to a date."""
    return datetime.strptime(text.strip(), "%m/%d/%Y").date()


def clean_description(text: str) -> str:
    """Join the lines of a wrapped cell and squeeze whitespace."""
    return re.sub(r"\s+", " ", text).strip()


def classify_row(description: str) -> Optional[str]:
    """Why a row is not a tire sale, or None when it is a tire row.

    Rules so far: shipping and handling, tubes, and anything with no tire size.
    (Brand codes are added to this check when they exist.)
    """
    lowered = description.lower()
    if "shipping" in lowered or "handling" in lowered:
        return "shipping/handling"
    if re.search(r"\btube\b", lowered):
        return "tube"
    if not has_tire_size(description):
        return "no tire size"
    return None


def _make_row(date_text: str, invoice: str, description: str, qty_text: str,
              warnings: list[str]) -> Optional[SaleRow]:
    try:
        sale_date = parse_report_date(date_text)
        qty = int(qty_text.strip())
    except ValueError:
        warnings.append(f"Skipped an unreadable row: {date_text} {invoice} qty '{qty_text}'")
        return None
    description = clean_description(description)
    return SaleRow(sale_date, invoice.strip(), description, qty, classify_row(description))


# ----------------------------------------------------------------- header block
def _parse_header(first_page_tables: list[list[list[Optional[str]]]], first_page_text: str,
                  report: Report) -> None:
    pairs: dict[str, str] = {}
    for table in first_page_tables:
        for row in table:
            cells = [(c or "").strip() for c in row]
            for i in range(0, len(cells) - 1, 2):
                if cells[i]:
                    pairs[cells[i].lower()] = clean_description(cells[i + 1])
    start = pairs.get("start date")
    end = pairs.get("end date")
    if not start or not end:  # fall back to the page text
        m1 = re.search(rf"Start Date\s+({_DATE_RE})", first_page_text)
        m2 = re.search(rf"End Date\s+({_DATE_RE})", first_page_text)
        start = start or (m1.group(1) if m1 else None)
        end = end or (m2.group(1) if m2 else None)
    try:
        report.period_start = parse_report_date(start) if start else None
        report.period_end = parse_report_date(end) if end else None
    except ValueError:
        report.warnings.append("Could not read the report's Start Date / End Date.")
    report.location = pairs.get("location")


# --------------------------------------------------------------- table reading
def _is_data_table(table: list[list[Optional[str]]]) -> bool:
    if not table:
        return False
    first = [(c or "").strip().lower() for c in table[0]]
    return first[:4] == HEADER_CELLS


def _rows_from_tables(pages_tables, report: Report) -> int:
    """Rows from every table that has the report's column headings. Returns how many tables it found."""
    found_tables = 0
    for tables in pages_tables:
        for table in tables:
            if not _is_data_table(table):
                continue
            found_tables += 1
            for cells in table[1:]:
                cells = [(c or "") for c in cells]
                if len(cells) < 4 or [c.strip().lower() for c in cells[:4]] == HEADER_CELLS:
                    continue
                if not any(c.strip() for c in cells):
                    continue
                row = _make_row(cells[0], cells[1], cells[2], cells[3], report.warnings)
                if row:
                    report.rows.append(row)
    return found_tables


# ------------------------------------------------- position-based fallback reader
def rows_from_page_words(page, warnings: list[str]) -> list[SaleRow]:
    """Fallback when no table is detected: read words by position.

    The report centers each row's date, invoice # and quantity vertically, so a wrapped description
    has its first line ABOVE the date line. Plain line-by-line text cannot be trusted. Instead:
    find the column positions from the heading row, use each date line as a row anchor, and give
    every description word to the nearest anchor.
    """
    words = page.extract_words()

    def first(text: str):
        return next((w for w in words if w["text"] == text), None)

    h_date, h_desc, h_qty = first("Invoiced"), first("Description"), first("Quantity")
    h_inv = next((w for w in words if w["text"] == "Invoice"
                  and h_date and abs(w["top"] - h_date["top"]) < 3), None)
    if not (h_date and h_inv and h_desc and h_qty):
        return []  # a page without the table (or an unfamiliar layout)

    def col(w) -> str:
        if w["x0"] >= h_qty["x0"] - 2:
            return "qty"
        if w["x0"] >= h_desc["x0"] - 2:
            return "desc"
        if w["x0"] >= h_inv["x0"] - 2:
            return "inv"
        return "date"

    mid = lambda w: (w["top"] + w["bottom"]) / 2
    body = [w for w in words if w["top"] > h_date["bottom"]]

    anchors = []  # (y, date_text, invoice, qty_text)
    for w in body:
        if col(w) != "date" or not re.fullmatch(_DATE_RE, w["text"]):
            continue
        near = lambda c, pattern: next(
            (x for x in body if col(x) == c and abs(mid(x) - mid(w)) <= _ROW_TOLERANCE
             and re.fullmatch(pattern, x["text"])), None)
        inv, qty = near("inv", r"\d{3,}"), near("qty", r"\d+")
        if inv and qty:  # the page footer's time stamp has neither, so it is not a row
            anchors.append((mid(w), w["text"], inv["text"], qty["text"]))
    if not anchors:
        return []

    pieces: list[list[dict]] = [[] for _ in anchors]
    for w in body:
        if col(w) == "desc":
            nearest = min(range(len(anchors)), key=lambda i: abs(anchors[i][0] - mid(w)))
            pieces[nearest].append(w)

    rows = []
    for (y, date_text, invoice, qty_text), parts in zip(anchors, pieces):
        parts.sort(key=lambda w: (round(w["top"]), w["x0"]))
        row = _make_row(date_text, invoice, " ".join(w["text"] for w in parts), qty_text, warnings)
        if row:
            rows.append(row)
    return rows


# ------------------------------------------------------------------- public API
def parse_report(path: str | Path, use_fallback: bool = False) -> Report:
    """Read a Material Sales PDF. Raises ReportError with a plain message on failure.

    Tables are used when the PDF has them. `use_fallback=True` forces the position-based reader
    (also used automatically when no table is found).
    """
    path = Path(path)
    if not path.is_file():
        raise ReportError(f"The report file was not found: {path}")
    report = Report(path=path)
    try:
        with pdfplumber.open(path) as pdf:
            if not pdf.pages:
                raise ReportError("The report PDF has no pages.")
            pages_tables = [page.extract_tables() for page in pdf.pages]
            _parse_header(pages_tables[0], pdf.pages[0].extract_text() or "", report)
            found = 0 if use_fallback else _rows_from_tables(pages_tables, report)
            if found == 0:
                for page in pdf.pages:
                    report.rows.extend(rows_from_page_words(page, report.warnings))
    except ReportError:
        raise
    except Exception as exc:  # unreadable or not a PDF
        raise ReportError(
            f"Could not read this file as a PDF: {path.name} ({exc.__class__.__name__})") from exc

    if not report.rows:
        raise ReportError(
            "No sales rows were found. Is this the Protractor 'Material Sales' report "
            "(columns: Invoiced, Invoice #, Description, Quantity)?"
        )
    return report
