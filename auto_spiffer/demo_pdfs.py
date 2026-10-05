"""Development helper: make small fake invoice PDFs so the invoice features can be tried and tested
without real customer invoices. Nothing in the real workflow uses this module."""
from __future__ import annotations

from datetime import timedelta
from pathlib import Path

from auto_spiffer.models import format_page_date
from auto_spiffer.report_parse import Report


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def make_text_pdf(path: str | Path, lines: list[str]) -> Path:
    """Write a one-page PDF whose text is the given lines (plain Helvetica, readable by pdfplumber)."""
    body = ["BT", "/F1 11 Tf", "50 750 Td", "15 TL"]
    body += [f"({_escape(line)}) Tj T*" for line in lines]
    body.append("ET")
    stream = "\n".join(body)
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        "/Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n{obj}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    path = Path(path)
    path.write_bytes(bytes(out))
    return path


def make_invoice_pdf(path: str | Path, invoice: str, invoice_date, tire_line: str, qty: int = 4) -> Path:
    """A fake invoice with the same labels as a Protractor invoice."""
    return make_text_pdf(path, [
        "10/12/2024 11:19 AM Invoice #" + invoice,   # the print stamp, NOT the sale date
        "Invoice (demo)",
        f"Invoice # {invoice}",
        f"Invoice Date {invoice_date.month}/{invoice_date.day}/{invoice_date.year} 2:09 PM",
        "Mount, Install & Balance Tires",
        f"{tire_line} {qty} Unit $100.00 / Unit",
        f"Invoice #{invoice}",
    ])


def make_demo_invoices(report: Report, folder: str | Path, count: int = 5) -> list[str]:
    """Fake invoices for the first `count` invoice numbers of the report's tire rows.

    Deliberately wrong, so the cross-checks have something to find:
      the 2nd invoice has a date one day off, the 3rd shows a different tire size.
    Plus one stray PDF for an invoice number that is not in the report. Returns notes.
    """
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    notes = []
    seen: list[str] = []
    for row in report.tire_rows:
        if row.invoice in seen:
            continue
        if len(seen) >= count:
            break
        seen.append(row.invoice)
        n = len(seen)
        when, line = row.sale_date, row.description
        if n == 2:
            when += timedelta(days=1)
            notes.append(f"{row.invoice}: invoice date is one day off ({format_page_date(when)})")
        if n == 3:
            line = "FAKE TIRE 205/55R16 91V"
            notes.append(f"{row.invoice}: tire size on the invoice is different (205/55R16)")
        make_invoice_pdf(folder / f"invoice_{row.invoice}.pdf", row.invoice, when, line, row.qty)
    make_invoice_pdf(folder / "invoice_999999.pdf", "999999", report.rows[0].sale_date, "ANY TIRE 205/55R16 91V")
    notes.append("999999: an invoice that is not in the report at all")
    return [f"Created {len(seen) + 1} PDFs in {folder}"] + notes
