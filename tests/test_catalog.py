from dataclasses import replace
from datetime import date

import pytest

from auto_spiffer import paths
from auto_spiffer.catalog import (Catalog, CatalogError, compact_key, diff_catalogs, list_history,
                                  load_catalog, save_catalog, slugify)
from auto_spiffer.catalog_import import parse_claimform, parse_lines
from auto_spiffer.cli import main
from auto_spiffer.models import CatalogItem

BRANDS = ["Continental", "Falken", "General", "Hercules", "Nitto", "Nokian", "Pirelli", "Toyo"]


@pytest.fixture(scope="module")
def october():
    from pathlib import Path
    return parse_claimform(Path(__file__).parent / "fixtures" / "ClaimForm.pdf",
                           brands=type("B", (), {"claimform_names": BRANDS})())


def item(brand, model, category="Passenger", value=2.0):
    return CatalogItem(id=slugify(brand, model, category),
                       site_text=f"{brand} {model} - {category} Tires", brand=brand, model=model,
                       category=category, unit_value=value)


def small_catalog(items, program="Test Program"):
    return Catalog(program, date(2026, 10, 1), date(2026, 10, 31), date(2026, 10, 4), "test", items)


# ------------------------------------------------------------- T9: reading the PDF
def test_october_list_counts(october):
    cat = october.catalog
    assert len(cat.items) == 77
    assert len(cat.tires) == 75 and len(cat.wheels) == 2
    assert october.unparsed == []
    assert october.warnings == []
    assert october.new_brands == []


def test_program_name_and_dates(october):
    cat = october.catalog
    assert cat.program == "October 2026 Pro Rewards"
    assert (cat.program_start, cat.program_end) == (date(2026, 10, 1), date(2026, 10, 31))


def test_pirelli_list_survives_the_page_break(october):
    assert sum(1 for i in october.catalog.items if i.brand == "Pirelli") == 15


def test_brand_counts(october):
    counts = {}
    for i in october.catalog.items:
        counts[i.brand] = counts.get(i.brand, 0) + 1
    assert counts == {"ATD": 2, "Continental": 8, "Falken": 6, "General": 10, "Hercules": 8,
                      "Nitto": 4, "Nokian": 8, "Pirelli": 15, "Toyo": 16}


def test_a_tire_is_split_correctly(october):
    it = october.catalog.find_by_text("General Altimax RT45 - Passenger Tires")
    assert (it.brand, it.model, it.category, it.unit_value, it.kind) == \
           ("General", "Altimax RT45", "Passenger", 3.0, "tire")
    assert it.id == "general-altimax-rt45-passenger"


def test_boat_trailer_category(october):
    it = october.catalog.find_by_text("Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES")
    assert it.category == "Boat Trailer" and it.unit_value == 1.0


def test_wheels(october):
    wheels = {i.site_text: i for i in october.catalog.wheels}
    assert set(wheels) == {"ATD Steel Wheels", "ATD Custom Wheels"}
    assert wheels["ATD Custom Wheels"].unit_value == 5.0
    assert wheels["ATD Steel Wheels"].category == ""


def test_ids_and_texts_are_unique(october):
    ids = [i.id for i in october.catalog.items]
    texts = [i.site_text for i in october.catalog.items]
    assert len(set(ids)) == len(ids) == 77
    assert len(set(texts)) == len(texts)


def test_look_alike_tires_stay_separate(october):
    texts = {i.site_text for i in october.catalog.items}
    assert "Nokian Outpost Apt - Light Truck Tires" in texts
    assert "Nokian Outpost nAT - Light Truck Tires" in texts
    assert "Continental Terrain Contact H/T - Light Truck Tires" in texts
    assert "Continental TerrainContact A/T - Light Truck Tires" in texts


def test_site_text_is_the_exact_claimform_wording(october):
    for i in october.catalog.tires:
        assert i.site_text.startswith(f"{i.brand} {i.model} - ")


LINES = [
    "Incentive Program Name:", "December 2026 Pro Rewards",
    "Incentive Program Dates:", "December 1 - December 31, 2026",
    "Mickey Thompson Baja Boss - Light Truck Tires $3.00",
    "Hankook Ventus - Passenger Tires $5.00",
    "Weird Unreadable Thing $4.00",
    "Hankook Ventus - Passenger Tires $5.00",
    "Grand Total:",
]


def test_synthetic_lines_cover_the_edge_cases():
    r = parse_lines(LINES, "x.pdf", ["Mickey Thompson", "Toyo"])
    assert r.catalog.program == "December 2026 Pro Rewards"
    assert (r.catalog.program_start, r.catalog.program_end) == (date(2026, 12, 1), date(2026, 12, 31))
    mt = r.catalog.find_by_text("Mickey Thompson Baja Boss - Light Truck Tires")
    assert (mt.brand, mt.model) == ("Mickey Thompson", "Baja Boss")  # longest brand wins
    assert r.new_brands == ["Hankook"]  # not in the brand list, flagged
    assert r.unparsed == ["Weird Unreadable Thing $4.00"]
    assert any("Listed twice" in w for w in r.warnings)
    assert len(r.catalog.items) == 2


def test_no_tires_is_a_plain_error():
    with pytest.raises(CatalogError, match="No tires were found"):
        parse_lines(["Just some text", "Grand Total:"], "x.pdf", BRANDS)


def test_wrong_file_errors(tmp_path, fixtures):
    with pytest.raises(CatalogError, match="not found"):
        parse_claimform(tmp_path / "missing.pdf")
    with pytest.raises(CatalogError, match="No tires were found"):
        parse_claimform(fixtures / "Material-Sales.pdf")
    bad = tmp_path / "fake.pdf"
    bad.write_text("not a pdf")
    with pytest.raises(CatalogError, match="Could not read"):
        parse_claimform(bad)


# ---------------------------------------------------------- T10: save and load
def test_save_and_load_round_trip(app_home, october):
    assert load_catalog() is None
    assert save_catalog(october.catalog) is None  # nothing to archive the first time
    loaded = load_catalog()
    assert loaded == october.catalog
    assert (paths.data_dir() / "catalog.json").is_file()


def test_second_save_archives_the_first(app_home, october):
    save_catalog(october.catalog)
    assert list_history() == []
    archived = save_catalog(replace(october.catalog, program="Changed"))
    assert archived is not None and archived.parent == paths.history_dir()
    assert "october-2026-pro-rewards" in archived.name
    assert len(list_history()) == 1
    save_catalog(october.catalog)
    assert len(list_history()) == 2  # a second archive never overwrites the first


def test_corrupt_catalog_gives_plain_error(app_home):
    paths.data_dir().mkdir(parents=True)
    (paths.data_dir() / "catalog.json").write_text("{not json")
    with pytest.raises(CatalogError, match="could not be read"):
        load_catalog()


# ------------------------------------------------------------------- T11: diff
def test_identical_lists_have_no_changes(october):
    d = diff_catalogs(october.catalog, october.catalog)
    assert not d.has_changes and d.unchanged == 77 and d.overlap == 1.0


def test_added_removed_value_changed_renamed():
    old = small_catalog([
        item("Toyo", "Celsius II", value=3.0),
        item("Toyo", "Open Country M/T", "Light Truck", 2.0),
        item("Falken", "Aklimate Pro", value=2.0),   # will be renamed to Aklimate
        item("Nitto", "Motivo 365", value=2.0),      # will be removed
        item("Nokian", "One HT", "Light Truck", 2.0),
    ])
    new = small_catalog([
        item("Toyo", "Celsius II", value=3.0),
        item("Toyo", "Open Country M/T", "Light Truck", 2.5),  # value changed
        item("Falken", "Aklimate", value=2.0),
        item("Nokian", "One HT", "Light Truck", 2.0),
        item("Pirelli", "P7 All Season Plus 3", value=2.0),    # added
    ])
    d = diff_catalogs(old, new)
    assert [i.model for i in d.added] == ["P7 All Season Plus 3"]
    assert [i.model for i in d.removed] == ["Motivo 365"]
    assert [(o.unit_value, n.unit_value) for o, n in d.value_changed] == [(2.0, 2.5)]
    assert [(o.model, n.model) for o, n in d.renamed] == [("Aklimate Pro", "Aklimate")]
    assert d.unchanged == 2


def test_rename_needs_the_same_value():
    old = small_catalog([item("Falken", "Aklimate Pro", value=2.0)])
    new = small_catalog([item("Falken", "Aklimate", value=3.0)])
    d = diff_catalogs(old, new)
    assert d.renamed == [] and len(d.added) == 1 and len(d.removed) == 1


def test_low_overlap_warns():
    old = small_catalog([item("Toyo", f"Model {n}") for n in range(10)])
    new = small_catalog([item("Nitto", f"Other {n}") for n in range(10)])
    d = diff_catalogs(old, new)
    assert d.overlap == 0
    assert any("right ClaimForm" in w for w in d.warnings)


def test_compact_key_and_slug():
    assert compact_key("AltiMAX RT45") == compact_key("ALTIMAX-RT45") == "altimaxrt45"
    assert slugify("Continental", "Terrain Contact H/T", "Light Truck") == \
           "continental-terrain-contact-h-t-light-truck"


# ------------------------------------------------------------------------- CLI
def test_cli_import_preview_does_not_save(app_home, fixtures, capsys):
    assert main(["catalog-import", str(fixtures / "ClaimForm.pdf")]) == 0
    out = capsys.readouterr().out
    assert "Items:      77  (75 tires, 2 wheels)" in out
    assert "Pirelli        15" in out
    assert "Preview only" in out
    assert load_catalog() is None


def test_cli_import_save_show_and_archive(app_home, fixtures, capsys):
    pdf = str(fixtures / "ClaimForm.pdf")
    assert main(["catalog-import", pdf, "--save"]) == 0
    assert "Saved 77 items" in capsys.readouterr().out
    assert main(["catalog-show"]) == 0
    out = capsys.readouterr().out
    assert "October 2026 Pro Rewards" in out
    assert "General Altimax RT45 - Passenger Tires" in out and "$3.00" in out
    assert main(["catalog-show", "--search", "grabber"]) == 0
    assert "5 match(es)" in capsys.readouterr().out
    assert main(["catalog-import", pdf, "--save"]) == 0
    assert "archived to" in capsys.readouterr().out
    assert len(list_history()) == 1


def test_cli_show_without_a_saved_list(app_home, capsys):
    assert main(["catalog-show"]) == 1
    assert "No tire list has been saved" in capsys.readouterr().out


def test_cli_diff_against_saved_is_clean(app_home, fixtures, capsys):
    pdf = str(fixtures / "ClaimForm.pdf")
    main(["catalog-import", pdf, "--save"])
    capsys.readouterr()
    assert main(["catalog-diff", pdf]) == 0
    assert "No changes" in capsys.readouterr().out


def test_cli_diff_demo(app_home, fixtures, capsys):
    assert main(["catalog-diff", str(fixtures / "ClaimForm.pdf"), "--demo"]) == 0
    out = capsys.readouterr().out
    assert "Added (new tires): 1" in out
    assert "Value changed: 1" in out
    assert "Probably renamed: 1" in out
    assert "Unchanged: 74" in out


def test_cli_diff_with_nothing_saved(app_home, fixtures, capsys):
    assert main(["catalog-diff", str(fixtures / "ClaimForm.pdf")]) == 1
    assert "nothing to compare" in capsys.readouterr().out


def test_cli_import_wrong_file(app_home, fixtures, capsys):
    assert main(["catalog-import", str(fixtures / "Material-Sales.pdf")]) == 1
    assert "Error:" in capsys.readouterr().out
