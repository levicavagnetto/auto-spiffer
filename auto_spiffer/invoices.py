"""Invoice PDFs: find out which invoice each PDF is, index a folder of them, and link them to sales.

The invoice PDFs are not the data source (the Material Sales report is). They only get uploaded
to the claim, so all this module needs from a PDF is its invoice number, plus a few facts for a
light cross-check (the invoice date and the tire size).
"""
from __future__ import annotations

import hashlib
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import TYPE_CHECKING, Iterable, Optional

import pdfplumber

from auto_spiffer.models import format_page_date
from auto_spiffer.report_parse import parse_report_date
from auto_spiffer.sizes import find_sizes

if TYPE_CHECKING:  # avoid a circular import; report_match only needs the name
    from auto_spiffer.report_match import MatchedRow

# "Invoice # 192982" in the body, "Invoice #192982" in the page header and footer.
_INVOICE_NO_RE = re.compile(r"Invoice\s*#\s*(\d{3,})")
# The label matters: the stamp at the top of each page ("10/12/2024 11:19 AM") is the PRINT time.
_INVOICE_DATE_RE = re.compile(r"Invoice Date\s+(\d{1,2}/\d{1,2}/\d{4})")
_FILENAME_NO_RE = re.compile(r"(?<!\d)(\d{5,7})(?!\d)")
_SIZE_CORE_RE = re.compile(r"(\d{2,3})\s?[/xX]\s?(\d{1,2}(?:\.\d+)?)\s?Z?R\s?(\d{2})", re.IGNORECASE)


class InvoiceError(Exception):
    """An invoice PDF could not be read. The message is written for the person using the app."""


@dataclass
class InvoicePdf:
    path: Path
    invoice: Optional[str]            # the invoice number this PDF is for
    numbers: list[str] = field(default_factory=list)  # every distinct number found inside
    invoice_date: Optional[date] = None
    sizes: list[str] = field(default_factory=list)    # tire sizes found on the invoice
    file_hash: str = ""               # sha256, used later to never upload the same file twice
    from_filename: bool = False       # the number came from the file name, not from inside the PDF
    warnings: list[str] = field(default_factory=list)


def size_core(size: str) -> Optional[tuple[float, float, int]]:
    """235/50R18, LT265/75R16/10 and 35X12.5R18LT/12 reduced to comparable numbers."""
    m = _SIZE_CORE_RE.search(size)
    if not m:
        return None
    return float(m.group(1)), float(m.group(2)), int(m.group(3))


def read_invoice(path: str | Path) -> InvoicePdf:
    """Read one invoice PDF. Raises InvoiceError with a plain message when it cannot be read."""
    path = Path(path)
    if not path.is_file():
        raise InvoiceError(f"The invoice file was not found: {path}")
    try:
        data = path.read_bytes()
        with pdfplumber.open(path) as pdf:
            text = "\n".join((page.extract_text() or "") for page in pdf.pages)
    except Exception as exc:
        raise InvoiceError(
            f"Could not read this file as a PDF: {path.name} ({exc.__class__.__name__})") from exc

    pdf_info = InvoicePdf(path=path, invoice=None, file_hash=hashlib.sha256(data).hexdigest())

    found = _INVOICE_NO_RE.findall(text)
    if found:
        counts = Counter(found)
        pdf_info.numbers = list(dict.fromkeys(found))
        pdf_info.invoice = max(pdf_info.numbers, key=lambda n: (counts[n], -pdf_info.numbers.index(n)))
        if len(pdf_info.numbers) > 1:
            pdf_info.warnings.append(
                "More than one invoice number inside this PDF: " + ", ".join(pdf_info.numbers)
                + f" (using {pdf_info.invoice})")
    else:
        from_name = _FILENAME_NO_RE.search(path.stem)
        if from_name:
            pdf_info.invoice, pdf_info.from_filename = from_name.group(1), True
            pdf_info.numbers = [pdf_info.invoice]
            pdf_info.warnings.append("No invoice number inside the PDF, used the one in the file name")
        else:
            pdf_info.warnings.append("No invoice number found inside the PDF or in its file name")

    if pdf_info.invoice and not pdf_info.from_filename:
        in_name = _FILENAME_NO_RE.search(path.stem)
        if in_name and in_name.group(1) != pdf_info.invoice:
            pdf_info.warnings.append(
                f"The file name says {in_name.group(1)} but the PDF says {pdf_info.invoice} (using the PDF)")

    date_match = _INVOICE_DATE_RE.search(text)
    if date_match:
        try:
            pdf_info.invoice_date = parse_report_date(date_match.group(1))
        except ValueError:
            pdf_info.warnings.append("Could not read the Invoice Date")
    pdf_info.sizes = list(dict.fromkeys(find_sizes(text)))
    return pdf_info


# ------------------------------------------------------------------------ index
@dataclass
class InvoiceIndex:
    by_invoice: dict[str, list[InvoicePdf]] = field(default_factory=dict)
    problems: list[tuple[Path, str]] = field(default_factory=list)  # files that could not be used
    skipped: list[Path] = field(default_factory=list)               # files that are not PDFs

    @property
    def pdfs(self) -> list[InvoicePdf]:
        return [p for group in self.by_invoice.values() for p in group]

    @property
    def duplicates(self) -> dict[str, list[InvoicePdf]]:
        """Invoice numbers with more than one PDF."""
        return {n: group for n, group in self.by_invoice.items() if len(group) > 1}

    def pdf_for(self, invoice: str) -> Optional[InvoicePdf]:
        group = self.by_invoice.get(invoice)
        return group[0] if group else None


def index_paths(files: Iterable[str | Path]) -> InvoiceIndex:
    """Index PDF files by invoice number. Unreadable files are listed, never fatal."""
    index = InvoiceIndex()
    for path in sorted((Path(f) for f in files), key=lambda p: p.name.lower()):
        if path.suffix.lower() != ".pdf":
            index.skipped.append(path)
            continue
        try:
            info = read_invoice(path)
        except InvoiceError as exc:
            index.problems.append((path, str(exc)))
            continue
        if info.invoice is None:
            index.problems.append((path, info.warnings[-1] if info.warnings else "No invoice number found"))
            continue
        index.by_invoice.setdefault(info.invoice, []).append(info)
    for number, group in index.duplicates.items():
        same = len({p.file_hash for p in group}) == 1
        note = ("identical copies of the same file" if same else "different files for the same invoice")
        for extra in group[1:]:
            extra.warnings.append(f"Another PDF already covers invoice {number} ({note}); this one is not used")
    return index


def index_folder(folder: str | Path) -> InvoiceIndex:
    """Index every PDF directly inside a folder (subfolders are not searched)."""
    folder = Path(folder)
    if not folder.is_dir():
        raise InvoiceError(f"The invoice folder was not found: {folder}")
    return index_paths(p for p in folder.iterdir() if p.is_file())


# ------------------------------------------------------------------------- link
@dataclass
class LinkReport:
    missing: list[str] = field(default_factory=list)    # invoices to claim that have no PDF
    unused: list[InvoicePdf] = field(default_factory=list)    # PDFs for invoices not in the report at all
    unneeded: list[InvoicePdf] = field(default_factory=list)  # PDFs for sales that will not be claimed
    warnings: list[str] = field(default_factory=list)   # cross-check differences (never blocking)


def crosscheck(row: "MatchedRow", pdf: InvoicePdf) -> list[str]:
    """Differences between a report row and its invoice PDF. Warnings only, they never block."""
    problems = []
    if pdf.invoice_date:
        for source in row.rows:
            if source.sale_date != pdf.invoice_date:
                problems.append(
                    f"{row.invoice}: the report says {format_page_date(source.sale_date)}, "
                    f"the invoice PDF says {format_page_date(pdf.invoice_date)}")
                break
    report_cores = {c for c in (size_core(s) for s in row.spec.sizes) if c}
    pdf_cores = {c for c in (size_core(s) for s in pdf.sizes) if c}
    if report_cores and pdf_cores and not report_cores & pdf_cores:
        problems.append(
            f"{row.invoice}: tire size {row.spec.sizes[0]} from the report was not found on the "
            f"invoice PDF (it shows {', '.join(pdf.sizes)})")
    return problems


def link_invoices(rows: list["MatchedRow"], index: InvoiceIndex,
                  all_report_invoices: Optional[Iterable[str]] = None) -> LinkReport:
    """Attach each row's PDF (row.pdf) and work out what is missing, unused, or not needed.

    `all_report_invoices`: every invoice number anywhere in the report, including shipping and tube
    rows, so that a PDF for such an invoice is not called unused.
    """
    from auto_spiffer.match import ATTENTION, READY

    report = LinkReport()
    in_report = set(all_report_invoices or ()) | {m.invoice for m in rows}
    to_claim = {m.invoice for m in rows if m.status in (READY, ATTENTION)}

    for m in rows:
        m.pdf = index.pdf_for(m.invoice)
        if m.pdf is not None:
            report.warnings.extend(crosscheck(m, m.pdf))
    report.missing = sorted(n for n in to_claim if n not in index.by_invoice)
    for number in sorted(index.by_invoice):
        pdf = index.by_invoice[number][0]
        if number not in in_report:
            report.unused.append(pdf)
        elif number not in to_claim:
            report.unneeded.append(pdf)
    return report
