"""Remembered decisions: what the person chose for a report wording the app was not sure about.

Stored in data/product_map.json and human-editable. An entry maps a signature (brand plus the
model words, compacted) to a tire id on the tire list, or to "not eligible".
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Optional

from auto_spiffer import paths
from auto_spiffer.catalog import Catalog, CatalogError, compact_key
from auto_spiffer.tirespec import TireSpec


def signature(spec: TireSpec) -> str:
    """A key for 'this wording of this brand', for example 'nokian|one'."""
    brand = spec.brand.name.lower() if spec.brand else "?"
    return f"{brand}|{compact_key(' '.join(spec.words))}"


@dataclass
class MapEntry:
    item_id: Optional[str]  # None together with skip=True means "not eligible"
    skip: bool
    example: str  # a report description that produced this entry, for humans reading the file
    decided_on: str
    inactive: bool = False  # the tire is no longer on the tire list; kept in case it comes back

    def to_dict(self) -> dict:
        return {"item_id": self.item_id, "skip": self.skip, "example": self.example,
                "decided_on": self.decided_on, "inactive": self.inactive}


class ProductMap:
    def __init__(self, entries: Optional[dict[str, MapEntry]] = None, path: Optional[Path] = None):
        self.entries: dict[str, MapEntry] = entries or {}
        self.path = path or (paths.data_dir() / "product_map.json")

    # ----------------------------------------------------------------- files
    @classmethod
    def load(cls, path: Optional[Path] = None) -> "ProductMap":
        path = Path(path) if path else paths.data_dir() / "product_map.json"
        if not path.exists():
            return cls(path=path)
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            entries = {sig: MapEntry(**data) for sig, data in raw.get("entries", {}).items()}
        except (ValueError, TypeError) as exc:
            raise CatalogError(f"The saved choices file could not be read ({path.name}): {exc}") from exc
        return cls(entries, path)

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = {"version": 1, "entries": {s: e.to_dict() for s, e in sorted(self.entries.items())}}
        self.path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # --------------------------------------------------------------- decisions
    def get(self, spec: TireSpec) -> Optional[MapEntry]:
        return self.entries.get(signature(spec))

    def remember(self, spec: TireSpec, item_id: Optional[str]) -> None:
        """Save a choice: a tire id, or None for 'not eligible'."""
        self.entries[signature(spec)] = MapEntry(
            item_id=item_id, skip=item_id is None, example=spec.raw,
            decided_on=date.today().isoformat())

    def forget(self, spec: TireSpec) -> bool:
        return self.entries.pop(signature(spec), None) is not None

    def sync(self, catalog: Catalog) -> list[str]:
        """Mark entries inactive when their tire is not on the list, and active again when it returns."""
        known = catalog.by_id()
        changed = []
        for sig, entry in self.entries.items():
            if entry.skip:
                continue
            inactive = entry.item_id not in known
            if inactive != entry.inactive:
                entry.inactive = inactive
                changed.append(sig)
        return changed
