"""Read ClaimForm.pdf (the monthly ProRewards tire list) into a Catalog."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import pdfplumber

from auto_spiffer.brands import BrandTable, load_brands
from auto_spiffer.catalog import Catalog, CatalogError, slugify
from auto_spiffer.models import CatalogItem

_PRICE = r"\$(?P<value>\d+(?:\.\d{1,2})?)"
# "General Altimax RT45 - Passenger Tires   $3.00"
TIRE_LINE_RE = re.compile(
    rf"^(?P<name>.+?) - (?P<category>[A-Za-z][A-Za-z ]*?\bTires?)\s+{_PRICE}$", re.IGNORECASE)
# "ATD Steel Wheels   $2.50"
WHEEL_LINE_RE = re.compile(rf"^(?P<name>.+?\bWheels?)\s+{_PRICE}$", re.IGNORECASE)
PRICED_LINE_RE = re.compile(r"\$\d+(?:\.\d{1,2})?$")
# "October 1 - October 31, 2026"
DATES_RE = re.compile(r"^([A-Za-z]+) (\d{1,2}) - (?:([A-Za-z]+) )?(\d{1,2}), (\d{4})$")
# A tire's price: at the end of a line, or followed by the next tire's name when two lines ran
# together. "$600.00 in any calendar year" (the terms) is followed by a small letter, so it does not count.
_PRICE_TOKEN_RE = re.compile(r"\$\d+(?:\.\d{1,2})?(?=\s*$|\s+[A-Z])")
# Each brand's section starts with this column heading line.
_SECTION_HEADING = "Description Total"
# The section's label: "← Falken Fanatic Program Member can claim ..." -> "Falken Fanatic Program Member".
_SECTION_LABEL_RE = re.compile(r"^←\s*(.+?(?:Member|Wheels)|.{1,40})")
# The browser's print footer: "https://.../ClaimForm.aspx?pid=157 2/5".
_PAGE_FOOTER_RE = re.compile(r"^https?://\S+\s+(\d+)/(\d+)$")


@dataclass
class ImportResult:
    catalog: Catalog
    unparsed: list[str] = field(default_factory=list)  # priced lines that did not fit any pattern
    new_brands: list[str] = field(default_factory=list)  # brands not in brands.toml
    warnings: list[str] = field(default_factory=list)
    # Signs the ClaimForm was not read completely (a second, plain count disagrees). Shown to the
    # person, who has to confirm before the list is used.
    problems: list[str] = field(default_factory=list)


def _normalize_category(raw: str) -> str:
    """'BOAT TRAILER TIRES' -> 'Boat Trailer'; 'Passenger Tires' -> 'Passenger'."""
    words = re.sub(r"\bTires?\b", "", raw, flags=re.IGNORECASE).split()
    return " ".join(w.capitalize() for w in words)


def _split_brand(name: str, brand_names: list[str]) -> tuple[str, str, bool]:
    """(brand, model, brand_is_known). The longest known brand name at the start wins."""
    lowered = name.lower()
    for brand in brand_names:
        if lowered.startswith(brand.lower() + " "):
            return brand, name[len(brand):].strip(), True
    first, _, rest = name.partition(" ")
    return first, rest.strip(), False


def _parse_program(lines: list[str]) -> tuple[Optional[str], Optional[date], Optional[date]]:
    name = start = end = None
    for i, line in enumerate(lines):
        if name is None and line.startswith("Incentive Program Name") and i + 1 < len(lines):
            name = lines[i + 1].strip()
        if start is None and line.startswith("Incentive Program Dates") and i + 1 < len(lines):
            m = DATES_RE.match(lines[i + 1].strip())
            if m:
                month1, day1, month2, day2, year = m.groups()
                try:
                    start = datetime.strptime(f"{month1} {day1} {year}", "%B %d %Y").date()
                    end = datetime.strptime(f"{month2 or month1} {day2} {year}", "%B %d %Y").date()
                except ValueError:
                    pass
    return name, start, end


def parse_claimform(path: str | Path, brands: Optional[BrandTable] = None) -> ImportResult:
    """Read the ClaimForm PDF. Raises CatalogError with a plain message when it cannot."""
    path = Path(path)
    if not path.is_file():
        raise CatalogError(f"The ClaimForm file was not found: {path}")
    try:
        with pdfplumber.open(path) as pdf:
            # The Pirelli list runs across a page break, so treat the whole file as one stream.
            lines = [ln.strip() for page in pdf.pages for ln in (page.extract_text() or "").splitlines()]
            pages = len(pdf.pages)
    except Exception as exc:
        raise CatalogError(
            f"Could not read this file as a PDF: {path.name} ({exc.__class__.__name__})") from exc

    result = parse_lines(lines, path.name, (brands or load_brands()).claimform_names)
    result.problems.extend(check_page_count(lines, pages))
    return result


def check_page_count(lines: list[str], pages: int) -> list[str]:
    """The print footer says '2/5': a file with fewer pages is an incomplete print or save."""
    totals = [int(m.group(2)) for m in map(_PAGE_FOOTER_RE.match, lines) if m]
    if totals and max(totals) > pages:
        return [f"The ClaimForm says it has {max(totals)} pages, but this file has only {pages}."]
    return []


def check_lines(lines: list[str], read: int, sections: list[list]) -> list[str]:
    """Compare what was read with a plain count of the prices on the form, and make sure every
    brand section gave at least one tire. A changed layout (margins, wrapped or merged lines)
    makes these disagree even when each line that was read looks fine."""
    problems = []
    prices = sum(len(_PRICE_TOKEN_RE.findall(line)) for line in lines)
    if prices > read:
        problems.append(f"The ClaimForm lists {prices} prices but only {read} tires and wheels were read, "
                        f"so {prices - read} may be missing.")
    for number, (label, count) in enumerate(sections, start=1):
        if count == 0:
            name = f"the '{label}' section" if label else f"section {number} of {len(sections)}"
            problems.append(f"No tires were read from {name}.")
    return problems


def parse_lines(lines: list[str], source: str, brand_names: list[str]) -> ImportResult:
    """Turn the text lines of a ClaimForm into a Catalog. Raises CatalogError if no tires are found."""
    program, start, end = _parse_program(lines)

    items: list[CatalogItem] = []
    result = ImportResult(catalog=Catalog(
        program=program or "(unknown program)", program_start=start, program_end=end,
        imported_on=date.today(), source=source))
    seen_ids: set[str] = set()
    seen_text: set[str] = set()
    sections: list[list] = []  # [label, lines read] for each brand section
    read = 0                   # priced lines read as a tire or wheel (duplicates included)

    for line in lines:
        if line == _SECTION_HEADING:
            sections.append([None, 0])
            continue
        if sections and sections[-1][0] is None and (label := _SECTION_LABEL_RE.match(line)):
            sections[-1][0] = label.group(1).strip()
        tire = TIRE_LINE_RE.match(line)
        wheel = None if tire else WHEEL_LINE_RE.match(line)
        if (tire or wheel) and "$" in (tire or wheel).group("name"):
            tire = wheel = None  # two tires ran together on one line: not one tire with a long name
        if tire or wheel:
            read += 1
            if sections:
                sections[-1][1] += 1
        if not tire and not wheel:
            if PRICED_LINE_RE.search(line) and len(line) < 100:
                result.unparsed.append(line)
            continue

        if tire:
            name, raw_category = tire.group("name").strip(), tire.group("category").strip()
            site_text = f"{name} - {raw_category}"
            category, kind = _normalize_category(raw_category), "tire"
        else:
            name, site_text = wheel.group("name").strip(), wheel.group("name").strip()
            category, kind = "", "wheel"
        value = float((tire or wheel).group("value"))

        brand, model, known = _split_brand(name, brand_names) if kind == "tire" else (
            name.split(" ", 1)[0], name.split(" ", 1)[1] if " " in name else "", True)
        if not known and brand not in result.new_brands:
            result.new_brands.append(brand)

        if site_text in seen_text:
            result.warnings.append(f"Listed twice, kept the first: {site_text}")
            continue
        seen_text.add(site_text)
        item_id = slugify(brand, model, category)
        if item_id in seen_ids:  # two different lines that slugify the same way
            n = 2
            while f"{item_id}-{n}" in seen_ids:
                n += 1
            item_id = f"{item_id}-{n}"
            result.warnings.append(f"Two tires have a similar name, id made unique: {site_text}")
        seen_ids.add(item_id)
        items.append(CatalogItem(id=item_id, site_text=site_text, brand=brand, model=model,
                                 category=category, unit_value=value, kind=kind))

    if not items:
        raise CatalogError(
            "No tires were found. Is this the ProRewards ClaimForm PDF "
            "(lines like 'General Altimax RT45 - Passenger Tires  $3.00')?")
    result.problems.extend(check_lines(lines, read, sections))
    if program is None:
        result.warnings.append("Could not find the program name.")
    if start is None or end is None:
        result.warnings.append("Could not find the program dates.")
    result.catalog.items = items
    return result
