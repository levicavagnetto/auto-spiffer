"""Remembers what has already been entered and uploaded, so running again never adds anything twice.

The ClaimForm terms say duplicate invoices for claimed tires can get a dealer removed from the
program, so this is a safety feature, not a convenience. Stored in data/state.json.

An entry is keyed by (invoice, product). Quantity is stored too, so a changed quantity is noticed
instead of silently claimed twice. A product of "*" means "anything on this invoice" and is used
by the test commands.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

from auto_spiffer import paths
from auto_spiffer.catalog import CatalogError

ANY_PRODUCT = "*"


def state_path_for_test_mode() -> Path:
    """Test mode keeps its own record so it never makes the real run think something was entered."""
    return paths.data_dir() / "state_test.json"


@dataclass
class EnteredEntry:
    invoice: str
    product: str
    qty: int
    sale_date: str      # mm/dd/yyyy as entered
    entered_on: str     # when the app entered it


@dataclass
class UploadedEntry:
    file_hash: str
    file: str
    invoice: str
    uploaded_on: str


class State:
    def __init__(self, entered: Optional[list[EnteredEntry]] = None,
                 uploaded: Optional[list[UploadedEntry]] = None, path: Optional[Path] = None):
        self.entered = entered or []
        self.uploaded = uploaded or []
        self.path = path or (paths.data_dir() / "state.json")

    # ----------------------------------------------------------------- files
    @classmethod
    def load(cls, path: Optional[Path] = None) -> "State":
        path = Path(path) if path else paths.data_dir() / "state.json"
        if not path.exists():
            return cls(path=path)
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            return cls([EnteredEntry(**e) for e in raw.get("entered", [])],
                       [UploadedEntry(**u) for u in raw.get("uploaded", [])], path)
        except (ValueError, TypeError) as exc:
            raise CatalogError(f"The record of what was entered could not be read ({path.name}): {exc}") from exc

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = {"version": 1,
                "entered": [asdict(e) for e in self.entered],
                "uploaded": [asdict(u) for u in self.uploaded]}
        self.path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # ---------------------------------------------------------------- entered
    def find_entered(self, invoice: str, product: str) -> Optional[EnteredEntry]:
        for e in self.entered:
            if e.invoice == invoice and e.product in (product, ANY_PRODUCT):
                return e
        return None

    def mark_entered(self, invoice: str, product: str, qty: int, sale_date: str) -> None:
        existing = self.find_entered(invoice, product)
        if existing is not None and existing.product == product:
            existing.qty, existing.sale_date = qty, sale_date
            existing.entered_on = _now()
            return
        self.entered.append(EnteredEntry(invoice, product, qty, sale_date, _now()))

    def forget_invoice(self, invoice: str) -> int:
        """Remove every entered and uploaded record of an invoice. Returns how many were removed."""
        before = len(self.entered) + len(self.uploaded)
        self.entered = [e for e in self.entered if e.invoice != invoice]
        self.uploaded = [u for u in self.uploaded if u.invoice != invoice]
        return before - len(self.entered) - len(self.uploaded)

    # --------------------------------------------------------------- uploaded
    def is_uploaded(self, file_hash: str) -> bool:
        return any(u.file_hash == file_hash for u in self.uploaded)

    def mark_uploaded(self, file_hash: str, file: str, invoice: str) -> None:
        if not self.is_uploaded(file_hash):
            self.uploaded.append(UploadedEntry(file_hash, file, invoice, _now()))


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")
