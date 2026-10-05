"""Plain data classes shared by the whole app. No logic that touches files or the GUI."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Optional


def format_page_date(value: date) -> str:
    """A date as the claim page wants it: mm/dd/yyyy."""
    return value.strftime("%m/%d/%Y")


@dataclass
class SaleRow:
    """One row of the Material Sales report."""

    sale_date: date
    invoice: str
    description: str
    qty: int
    ignored_reason: Optional[str] = None  # set when the row is not a tire (shipping, tube, ...)

    @property
    def is_tire(self) -> bool:
        return self.ignored_reason is None


@dataclass
class CatalogItem:
    """One entry of the ClaimForm tire list (exactly one option of the website dropdown)."""

    id: str
    site_text: str  # exact dropdown label, e.g. "General Altimax RT45 - Passenger Tires"
    brand: str
    model: str
    category: str  # "Passenger", "Light Truck", "Boat Trailer", or "" for wheels
    unit_value: float
    kind: str = "tire"  # "tire" or "wheel"
    active: bool = True

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "CatalogItem":
        return cls(**data)


@dataclass
class ClaimRow:
    """One line to enter on the claim page."""

    sale_date: date
    invoice: str
    product_text: str  # exact dropdown label (empty until a tire is settled)
    qty: int
    pdf_path: Optional[str] = None
    # ready, attention, not_eligible, problem, already_entered, excluded, entered, failed
    status: str = "ready"
    notes: list[str] = field(default_factory=list)
    description: str = ""          # the report's wording, for the person reading a report
    item_id: Optional[str] = None  # the matched tire's id on the tire list
    unit_value: float = 0.0        # payout per tire from the tire list
    merged_from: int = 1           # how many report rows were added together

    @property
    def estimated_payout(self) -> float:
        return self.qty * self.unit_value

    @property
    def sale_date_str(self) -> str:
        """The date as the claim page wants it: mm/dd/yyyy."""
        return format_page_date(self.sale_date)
