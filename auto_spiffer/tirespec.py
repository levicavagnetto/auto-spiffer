"""Take a Material Sales tire description apart, whatever order its parts come in.

Descriptions do not share a field order ("235/50R18 97H GEN AltiMAX RT45 ..." or
"NIT TERRA GRAPPLER G3 275/60R20XL 116T"). So nothing here depends on position:

  1. Pull out the parts that have an unmistakable shape: tire sizes, load/speed ratings,
     mileage warranties (65K). The report repeats some of them, so every copy is removed.
  2. Remove noise words (BW, XL, 3PMS, ...) from the editable noise.toml.
  3. Find the brand code (GEN, HER, ...) among the remaining words.
  4. What is left is the model words, for example ["AltiMAX", "RT45"].
"""
from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from auto_spiffer import paths
from auto_spiffer.brands import Brand, BrandTable, load_brands
from auto_spiffer.sizes import SIZE_RE

# 123/120S or 97H: load index (2-3 digits, optionally a pair) plus a speed letter. K is left out
# on purpose, because "65K" on this report is a mileage warranty.
_LOAD_SPEED_RE = re.compile(r"(?<![\w/])\d{2,3}(?:/\d{2,3})?[JLMNPQRSTUHVWY](?![\w/])", re.IGNORECASE)
_WARRANTY_RE = re.compile(r"\(?(?<![\w/])\d{2,3}K(?![\w])\)?", re.IGNORECASE)
_EDGE_PUNCTUATION = "()[],;:"


@dataclass
class NoiseRules:
    words: set[str]
    patterns: list[re.Pattern]

    def is_noise(self, token: str) -> bool:
        if token.upper() in self.words:
            return True
        return any(p.search(token) for p in self.patterns)


def load_noise(path: Optional[Path] = None) -> NoiseRules:
    path = path or paths.ensure_data_file("noise.toml")
    with open(path, "rb") as handle:
        data = tomllib.load(handle).get("noise", {})
    return NoiseRules(
        words={w.upper() for w in data.get("words", [])},
        patterns=[re.compile(p, re.IGNORECASE) for p in data.get("patterns", [])],
    )


@dataclass
class TireSpec:
    raw: str
    sizes: list[str] = field(default_factory=list)
    load_speed: list[str] = field(default_factory=list)
    warranties: list[str] = field(default_factory=list)
    noise: list[str] = field(default_factory=list)
    brand_code: Optional[str] = None  # the code as written on the report, e.g. "GEN"
    brand: Optional[Brand] = None
    brand_candidates: list[Brand] = field(default_factory=list)  # set when the brand is ambiguous
    words: list[str] = field(default_factory=list)  # the model words, original capitalization
    notes: list[str] = field(default_factory=list)


def _take(pattern: re.Pattern, text: str) -> tuple[list[str], str]:
    """All matches of the pattern, and the text with every match blanked out."""
    found = [m.group(0).strip(" ()") for m in pattern.finditer(text)]
    return found, pattern.sub(" ", text)


def _tokens(text: str) -> list[str]:
    cleaned = (t.strip(_EDGE_PUNCTUATION) for t in text.split())
    return [t for t in cleaned if t]


def _choose_brand(tokens: list[str], brands: BrandTable, spec: TireSpec) -> list[str]:
    """Decide the brand from the codes among the tokens. Returns the tokens that stay as model words."""
    hits = [(i, t, brands.lookup(t)) for i, t in enumerate(tokens)]
    hits = [(i, t, b) for i, t, b in hits if b is not None]
    if not hits:
        return tokens

    distinct = list({b.name: b for _, _, b in hits}.values())
    chosen: Optional[Brand] = None
    if len(distinct) == 1:
        chosen = distinct[0]
    else:
        others = [b for b in distinct if not b.on_claimform]
        if others:
            # A brand that is not on the ClaimForm wins ("IRON iMOVE GEN 3": GEN is part of the
            # model name, not the General brand).
            chosen = others[0]
            spec.notes.append(
                f"also contains {', '.join(t for _, t, b in hits if b != chosen)}, "
                f"treated as part of the model name")
        else:
            spec.brand_candidates = distinct
            spec.notes.append("more than one brand code: " + ", ".join(t for _, t, _ in hits))

    if chosen is None:
        return tokens  # ambiguous: keep every word for the matcher to weigh
    first = next(t for _, t, b in hits if b == chosen)
    spec.brand, spec.brand_code = chosen, first
    return [t for t in tokens if brands.lookup(t) != chosen]


def parse_tire(description: str, brands: Optional[BrandTable] = None,
               noise: Optional[NoiseRules] = None) -> TireSpec:
    brands = brands or load_brands()
    noise = noise or load_noise()
    spec = TireSpec(raw=description)

    spec.sizes, text = _take(SIZE_RE, description)
    spec.warranties, text = _take(_WARRANTY_RE, text)
    spec.load_speed, text = _take(_LOAD_SPEED_RE, text)

    tokens = []
    for token in _tokens(text):
        if noise.is_noise(token):
            spec.noise.append(token)
        else:
            tokens.append(token)

    spec.words = _choose_brand(tokens, brands, spec)
    return spec
