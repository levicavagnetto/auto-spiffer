"""The tire list (ClaimForm): saving, loading, archiving, and comparing two lists."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from rapidfuzz import fuzz

from auto_spiffer import paths
from auto_spiffer.models import CatalogItem


class CatalogError(Exception):
    """The tire list could not be read or saved. The message is written for the person using the app."""


def compact_key(text: str) -> str:
    """Lowercase letters and digits only, so 'AltiMAX RT45' and 'ALTIMAX-RT45' compare equal."""
    return re.sub(r"[^a-z0-9]", "", text.lower())


def slugify(*parts: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", " ".join(parts).lower()).strip("-")


@dataclass
class Catalog:
    program: str
    program_start: Optional[date]
    program_end: Optional[date]
    imported_on: date
    source: str
    items: list[CatalogItem] = field(default_factory=list)

    @property
    def tires(self) -> list[CatalogItem]:
        return [i for i in self.items if i.kind == "tire"]

    @property
    def wheels(self) -> list[CatalogItem]:
        return [i for i in self.items if i.kind == "wheel"]

    def by_id(self) -> dict[str, CatalogItem]:
        return {i.id: i for i in self.items}

    def find_by_text(self, site_text: str) -> Optional[CatalogItem]:
        return next((i for i in self.items if i.site_text == site_text), None)

    def to_dict(self) -> dict:
        return {
            "program": self.program,
            "program_start": self.program_start.isoformat() if self.program_start else None,
            "program_end": self.program_end.isoformat() if self.program_end else None,
            "imported_on": self.imported_on.isoformat(),
            "source": self.source,
            "items": [i.to_dict() for i in self.items],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Catalog":
        def day(value: Optional[str]) -> Optional[date]:
            return date.fromisoformat(value) if value else None

        return cls(
            program=data["program"],
            program_start=day(data.get("program_start")),
            program_end=day(data.get("program_end")),
            imported_on=day(data["imported_on"]),
            source=data.get("source", ""),
            items=[CatalogItem.from_dict(i) for i in data["items"]],
        )


# ---------------------------------------------------------------- storage
def catalog_path() -> Path:
    return paths.data_dir() / "catalog.json"


def load_catalog(path: Optional[Path] = None) -> Optional[Catalog]:
    """The saved tire list, or None if none has been saved yet."""
    path = Path(path) if path else catalog_path()
    if not path.exists():
        return None
    try:
        return Catalog.from_dict(json.loads(path.read_text(encoding="utf-8")))
    except (ValueError, KeyError, TypeError) as exc:
        raise CatalogError(f"The saved tire list could not be read ({path.name}): {exc}") from exc


def save_catalog(catalog: Catalog, path: Optional[Path] = None) -> Optional[Path]:
    """Save the tire list. The list it replaces is first copied into the history folder.

    Returns the path of the archived copy, or None if there was nothing to archive.
    """
    path = Path(path) if path else catalog_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    archived = None
    if path.exists():
        previous = load_catalog(path)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        name = slugify(previous.program) if previous else "unknown"
        paths.history_dir().mkdir(parents=True, exist_ok=True)
        archived = paths.history_dir() / f"catalog_{name}_{stamp}.json"
        counter = 2
        while archived.exists():
            archived = paths.history_dir() / f"catalog_{name}_{stamp}-{counter}.json"
            counter += 1
        archived.write_bytes(path.read_bytes())
    path.write_text(json.dumps(catalog.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
    return archived


def list_history() -> list[Path]:
    folder = paths.history_dir()
    return sorted(folder.glob("catalog_*.json")) if folder.exists() else []


# ------------------------------------------------------------------- diff
@dataclass
class CatalogDiff:
    added: list[CatalogItem] = field(default_factory=list)
    removed: list[CatalogItem] = field(default_factory=list)
    value_changed: list[tuple[CatalogItem, CatalogItem]] = field(default_factory=list)  # (old, new)
    renamed: list[tuple[CatalogItem, CatalogItem]] = field(default_factory=list)  # (old, new)
    unchanged: int = 0
    overlap: float = 1.0
    warnings: list[str] = field(default_factory=list)

    @property
    def has_changes(self) -> bool:
        return bool(self.added or self.removed or self.value_changed or self.renamed)


RENAME_SIMILARITY = 80  # percent, on the compact model text
LOW_OVERLAP = 0.6


def _name_similarity(a: str, b: str) -> float:
    """0 to 100. A model name that is the other with something added ('F-ICE' and 'F-ICE Pro') counts as 100."""
    ka, kb = compact_key(a), compact_key(b)
    short, long_ = sorted((ka, kb), key=len)
    if len(short) >= 4 and short in long_:
        return 100.0
    return fuzz.ratio(ka, kb)


def diff_catalogs(old: Catalog, new: Catalog) -> CatalogDiff:
    """What changed from the old list to the new one."""
    old_by_id, new_by_id = old.by_id(), new.by_id()
    diff = CatalogDiff()

    common = old_by_id.keys() & new_by_id.keys()
    for item_id in common:
        if old_by_id[item_id].unit_value != new_by_id[item_id].unit_value:
            diff.value_changed.append((old_by_id[item_id], new_by_id[item_id]))
        else:
            diff.unchanged += 1

    removed = [i for i in old.items if i.id not in new_by_id]
    added = [i for i in new.items if i.id not in old_by_id]

    # A removed and an added tire that look like the same tire under a new name are a rename.
    for gone in list(removed):
        best, best_score = None, 0
        for cand in added:
            if (cand.brand, cand.category, cand.unit_value) != (gone.brand, gone.category, gone.unit_value):
                continue
            score = _name_similarity(gone.model, cand.model)
            if score >= RENAME_SIMILARITY and score > best_score:
                best, best_score = cand, score
        if best is not None:
            diff.renamed.append((gone, best))
            removed.remove(gone)
            added.remove(best)
    diff.added, diff.removed = added, removed

    biggest = max(len(old.items), len(new.items), 1)
    diff.overlap = len(common) / biggest
    if old.items and diff.overlap < LOW_OVERLAP:
        diff.warnings.append(
            f"Only {diff.overlap:.0%} of the tires are the same in both lists. "
            "Is this the right ClaimForm file?")
    if old.program == new.program and diff.has_changes:
        diff.warnings.append(f"Both lists are for '{new.program}', but the contents differ.")
    return diff
