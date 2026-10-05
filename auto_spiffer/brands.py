"""Brand codes: which brand a short code on the report stands for, and whether it is on the ClaimForm."""
from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from auto_spiffer import paths


@dataclass(frozen=True)
class Brand:
    name: str
    on_claimform: bool  # False: a brand that exists on invoices but is never eligible


class BrandTable:
    def __init__(self, claimform: dict[str, str], other: dict[str, str]):
        self._claimform_names = sorted(set(claimform.values()), key=len, reverse=True)
        self._by_code: dict[str, Brand] = {}
        for code, name in other.items():
            self._by_code[code.upper()] = Brand(name, False)
        for code, name in claimform.items():
            self._by_code[code.upper()] = Brand(name, True)
        for name in claimform.values():  # the full brand name works as a code too
            self._by_code.setdefault(name.upper(), Brand(name, True))

    def lookup(self, token: str) -> Optional[Brand]:
        return self._by_code.get(token.upper())

    @property
    def claimform_names(self) -> list[str]:
        """Brand names as the ClaimForm spells them, longest first (so 'Mickey Thompson' beats 'Mickey')."""
        return list(self._claimform_names)

    @property
    def codes(self) -> list[str]:
        return sorted(self._by_code)


def load_brands(path: Optional[Path] = None) -> BrandTable:
    """Read brands.toml from the data folder (created from the defaults on first use)."""
    path = path or paths.ensure_data_file("brands.toml")
    with open(path, "rb") as handle:
        data = tomllib.load(handle)
    return BrandTable(data.get("claimform", {}), data.get("other", {}))
