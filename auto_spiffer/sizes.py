"""Recognize tire size text anywhere in a line.

Size shapes seen in the Material Sales report:
    235/50R18   255/35ZR19XL   LT265/75R16/10   ST205/75R14/8
    35X12.5R18LT/12   LT37X12.50R20/10   18X8.50/9.50-8 (bias trailer/tube)
A size is unmistakable, so it can be found wherever it sits in the description.
"""
from __future__ import annotations

import re

_METRIC = r"(?:LT|ST|P)?\d{3}/\d{2}\s?Z?R\s?\d{2}(?:XL|LT)?(?:/\d{1,2})?"
_FLOTATION = r"(?:LT)?\d{2}\s?X\s?\d{1,2}(?:\.\d{1,2})?\s?R\s?\d{2}(?:LT)?(?:/\d{1,2})?"
_BIAS = r"\d{1,2}X\d{1,2}(?:\.\d{1,2})?(?:/\d{1,2}(?:\.\d{1,2})?)?-\d{1,2}"

SIZE_RE = re.compile(
    rf"(?<![\w/])(?:{_METRIC}|{_FLOTATION}|{_BIAS})(?![\w])",
    re.IGNORECASE,
)


def find_sizes(text: str) -> list[str]:
    """Every tire size in the text, in order of appearance (the report often repeats it)."""
    return [m.group(0) for m in SIZE_RE.finditer(text)]


def has_tire_size(text: str) -> bool:
    return SIZE_RE.search(text) is not None
