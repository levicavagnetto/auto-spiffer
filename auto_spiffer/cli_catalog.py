"""Command line commands for the tire list: catalog-import, catalog-show, catalog-diff."""
from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from typing import Optional

from auto_spiffer.catalog import (Catalog, CatalogError, diff_catalogs, load_catalog, save_catalog,
                                  slugify)
from auto_spiffer.catalog_import import parse_claimform
from auto_spiffer.models import format_page_date

COMMANDS = ("catalog-import", "catalog-show", "catalog-diff")


def add_parsers(sub) -> None:
    ci = sub.add_parser("catalog-import", help="read a ClaimForm PDF (the tire list)")
    ci.add_argument("pdf", help="path to ClaimForm.pdf")
    ci.add_argument("--save", action="store_true", help="save it as the current tire list")
    ci.add_argument("--list", action="store_true", help="print every tire")
    cs = sub.add_parser("catalog-show", help="show the saved tire list")
    cs.add_argument("--search", help="only tires whose name contains this text")
    cd = sub.add_parser("catalog-diff", help="compare a ClaimForm PDF with the saved tire list")
    cd.add_argument("pdf", help="path to the new ClaimForm.pdf")
    cd.add_argument("--against", help="compare with this catalog .json instead of the saved list")
    cd.add_argument("--demo", action="store_true",
                    help="compare with a deliberately altered copy of the PDF's own list")


def run(args) -> int:
    if args.command == "catalog-import":
        return cmd_import(args.pdf, args.save, args.list)
    if args.command == "catalog-show":
        return cmd_show(args.search)
    return cmd_diff(args.pdf, args.against, args.demo)


# ---------------------------------------------------------------- printing helpers
def _program_and_dates(catalog: Catalog) -> tuple[str, str]:
    start = format_page_date(catalog.program_start) if catalog.program_start else "?"
    end = format_page_date(catalog.program_end) if catalog.program_end else "?"
    return catalog.program, f"{start} to {end}"


def _print_brand_counts(catalog: Catalog) -> None:
    counts: dict[str, int] = {}
    for item in catalog.items:
        counts[item.brand] = counts.get(item.brand, 0) + 1
    print("By brand:")
    for brand in sorted(counts):
        print(f"  {brand:<14} {counts[brand]}")


def _print_items(items) -> None:
    for item in items:
        print(f"  {item.site_text:<62} ${item.unit_value:.2f}")


# ------------------------------------------------------------------ catalog-import
def cmd_import(pdf: str, save: bool, show_list: bool) -> int:
    try:
        result = parse_claimform(pdf)
    except CatalogError as exc:
        print(f"Error: {exc}")
        return 1
    cat = result.catalog
    program, dates = _program_and_dates(cat)
    print(f"File:       {cat.source}")
    print(f"Program:    {program}")
    print(f"Dates:      {dates}")
    print(f"Items:      {len(cat.items)}  ({len(cat.tires)} tires, {len(cat.wheels)} wheels)")
    print(f"Unparsed:   {len(result.unparsed)}")
    for line in result.unparsed:
        print(f"  could not read: {line}")
    for brand in result.new_brands:
        print(f"Note: new brand '{brand}' is not in brands.toml")
    for warning in result.warnings:
        print(f"Warning: {warning}")
    print()
    _print_brand_counts(cat)
    if show_list:
        print()
        _print_items(cat.items)
    print()
    if save:
        archived = save_catalog(cat)
        print(f"Saved {len(cat.items)} items as the current tire list.")
        if archived:
            print(f"The previous list was archived to: {archived}")
    else:
        print("Preview only. Add --save to keep this as the current tire list.")
    return 0


# -------------------------------------------------------------------- catalog-show
def cmd_show(search: Optional[str]) -> int:
    try:
        cat = load_catalog()
    except CatalogError as exc:
        print(f"Error: {exc}")
        return 1
    if cat is None:
        print("No tire list has been saved yet. Run: catalog-import <ClaimForm.pdf> --save")
        return 1
    program, dates = _program_and_dates(cat)
    print(f"Program:    {program}")
    print(f"Dates:      {dates}")
    print(f"Imported:   {cat.imported_on:%m/%d/%Y} from {cat.source}")
    print(f"Items:      {len(cat.items)}  ({len(cat.tires)} tires, {len(cat.wheels)} wheels)")
    print()
    items = [i for i in cat.items if not search or search.lower() in i.site_text.lower()]
    _print_items(items)
    if search:
        print(f"\n{len(items)} match(es) for '{search}'")
    return 0


# -------------------------------------------------------------------- catalog-diff
def _demo_old_list(new: Catalog) -> tuple[Catalog, list[str]]:
    """A deliberately altered copy of a list: one tire missing, one value changed, one renamed."""
    items = list(new.items)
    notes = []

    gone = next(i for i in items if i.brand == "Pirelli")
    items.remove(gone)
    notes.append(f"missing from the old copy:  {gone.site_text}")

    k = next(n for n, i in enumerate(items) if i.brand == "Toyo")
    was = items[k].unit_value
    items[k] = replace(items[k], unit_value=was + 0.5)
    notes.append(f"value was ${items[k].unit_value:.2f} in the old copy: {items[k].site_text}  (now ${was:.2f})")

    k = next(n for n, i in enumerate(items) if i.brand == "Falken")
    old_model = items[k].model + " Pro"
    items[k] = replace(items[k], model=old_model,
                       id=slugify(items[k].brand, old_model, items[k].category),
                       site_text=items[k].site_text.replace(items[k].model, old_model))
    notes.append(f"named differently in the old copy: {items[k].site_text}")

    old = Catalog(program=new.program, program_start=new.program_start, program_end=new.program_end,
                  imported_on=new.imported_on, source="altered copy (demo)", items=items)
    return old, notes


def cmd_diff(pdf: str, against: Optional[str], demo: bool) -> int:
    try:
        new = parse_claimform(pdf).catalog
        notes: list[str] = []
        if demo:
            old, notes = _demo_old_list(new)
        else:
            old = load_catalog(Path(against) if against else None)
            if old is None:
                print("No tire list has been saved yet, so there is nothing to compare with.")
                print("Run: catalog-import <ClaimForm.pdf> --save")
                return 1
    except CatalogError as exc:
        print(f"Error: {exc}")
        return 1

    diff = diff_catalogs(old, new)
    print(f"Old list: {old.program}  ({old.source})")
    print(f"New list: {new.program}  ({new.source})")
    for note in notes:
        print(f"  [demo] {note}")
    print()
    if not diff.has_changes:
        print("No changes. The lists are the same.")
    for title, items in (("Added (new tires)", diff.added),
                         ("Removed (no longer on the list)", diff.removed)):
        if items:
            print(f"{title}: {len(items)}")
            _print_items(items)
    if diff.value_changed:
        print(f"Value changed: {len(diff.value_changed)}")
        for old_item, new_item in diff.value_changed:
            print(f"  {new_item.site_text:<62} ${old_item.unit_value:.2f} -> ${new_item.unit_value:.2f}")
    if diff.renamed:
        print(f"Probably renamed: {len(diff.renamed)}")
        for old_item, new_item in diff.renamed:
            print(f"  {old_item.site_text}  ->  {new_item.site_text}")
    print()
    print(f"Unchanged: {diff.unchanged}")
    for warning in diff.warnings:
        print(f"Warning: {warning}")
    return 0
