"""Match every tire row of a Material Sales report, then merge split rows."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING, Optional

from auto_spiffer.brands import BrandTable
from auto_spiffer.catalog import Catalog
from auto_spiffer.match import READY, MatchResult, match_tire
from auto_spiffer.models import SaleRow
from auto_spiffer.product_map import ProductMap, signature
from auto_spiffer.report_parse import Report
from auto_spiffer.tirespec import NoiseRules, TireSpec, parse_tire

if TYPE_CHECKING:
    from auto_spiffer.invoices import InvoicePdf


@dataclass
class MatchedRow:
    """One line to claim: one or more report rows of the same invoice and tire."""

    rows: list[SaleRow]
    spec: TireSpec
    result: MatchResult
    pdf: Optional["InvoicePdf"] = None  # set by invoices.link_invoices

    @property
    def sale_date(self) -> date:
        return self.rows[0].sale_date

    @property
    def invoice(self) -> str:
        return self.rows[0].invoice

    @property
    def description(self) -> str:
        return self.rows[0].description

    @property
    def qty(self) -> int:
        return sum(r.qty for r in self.rows)

    @property
    def merged(self) -> bool:
        return len(self.rows) > 1

    @property
    def status(self) -> str:
        return self.result.status


def match_report(report: Report, catalog: Catalog, brands: Optional[BrandTable] = None,
                 noise: Optional[NoiseRules] = None,
                 product_map: Optional[ProductMap] = None) -> list[MatchedRow]:
    """One MatchedRow per tire row of the report (not merged yet)."""
    matched = []
    for row in report.tire_rows:
        spec = parse_tire(row.description, brands, noise)
        matched.append(MatchedRow([row], spec, match_tire(spec, catalog, product_map)))
    return matched


def _merge_key(m: MatchedRow) -> tuple:
    # Same invoice and the same matched tire. Rows that are not ready have no settled tire yet,
    # so they merge when the report wording is the same.
    tire = m.result.item.id if m.result.status == READY and m.result.item else signature(m.spec)
    return (m.invoice, m.sale_date, m.result.status, tire)


def merge_rows(rows: list[MatchedRow]) -> list[MatchedRow]:
    """Add up the quantities of rows with the same invoice and tire (214962: qty 1 and 3 become 4)."""
    merged: dict[tuple, MatchedRow] = {}
    for m in rows:
        key = _merge_key(m)
        if key in merged:
            merged[key].rows.extend(m.rows)
        else:
            merged[key] = MatchedRow(list(m.rows), m.spec, m.result)
    return list(merged.values())
