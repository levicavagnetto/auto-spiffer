import re
from datetime import date
from pathlib import Path

import pytest

from auto_spiffer import paths
from auto_spiffer.brands import BrandTable
from auto_spiffer.catalog import Catalog, slugify
from auto_spiffer.catalog_import import parse_claimform
from auto_spiffer.cli import main
from auto_spiffer.match import ATTENTION, NOT_ELIGIBLE, READY, match_tire
from auto_spiffer.models import CatalogItem, SaleRow
from auto_spiffer.product_map import ProductMap, signature
from auto_spiffer.report_match import MatchedRow, match_report, merge_rows
from auto_spiffer.report_parse import parse_report
from auto_spiffer.tirespec import NoiseRules, parse_tire

FIXTURES = Path(__file__).parent / "fixtures"
BRAND_NAMES = ["Continental", "Falken", "General", "Hercules", "Nitto", "Nokian", "Pirelli", "Toyo"]


@pytest.fixture(scope="module")
def brands():
    return BrandTable(
        claimform={"CON": "Continental", "FAL": "Falken", "GEN": "General", "HER": "Hercules",
                   "NIT": "Nitto", "NOK": "Nokian", "TOY": "Toyo", "PIRELLI": "Pirelli"},
        other={"CAR": "Carlisle", "FST": "FST", "IRON": "Ironman"},
    )


@pytest.fixture(scope="module")
def noise():
    return NoiseRules(
        words={"BW", "M", "XL", "RF", "SL", "OWL", "RWL", "WL", "3PMS", "3PMSF", "M+S", "M/S", "MS"},
        patterns=[re.compile(r"^\d{1,2}PR$", re.IGNORECASE)],
    )


@pytest.fixture(scope="module")
def catalog(brands):
    class Names:
        claimform_names = BRAND_NAMES
    return parse_claimform(FIXTURES / "ClaimForm.pdf", brands=Names()).catalog


def run(description, catalog, brands, noise, product_map=None):
    return match_tire(parse_tire(description, brands, noise), catalog, product_map)


def tire_text(result):
    return result.item.site_text if result.item else None


# ----------------------------------------------------------- T12: exact matching
def test_first_example_is_exact(catalog, brands, noise):
    r = run("235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)", catalog, brands, noise)
    assert (r.status, r.tier, r.score) == (READY, "exact", 100.0)
    assert tire_text(r) == "General Altimax RT45 - Passenger Tires"


@pytest.mark.parametrize("description, expected", [
    ("LT255/75R17/6 111/108S TOY OPEN COUNTRY A/T III 50K LT255/75R17/6 BW 111/108S (50K)",
     "Toyo Open Country A/T III - Light Truck Tires"),
    ("LT265/75R16/10 123/120S NOK OUTPOST NAT BW 60K", "Nokian Outpost nAT - Light Truck Tires"),
    ("225/65R17 102H CON SECURECONTACT AW BW 60K", "Continental SecureContact AW - Passenger Tires"),
    ("265/70R16 112T FAL WILDPEAK A/T4W BW 65K", "Falken Wildpeak A/T4W - Light Truck Tires"),
    ("205/60R16 92V FAL AKLIMATE BW 65K", "Falken Aklimate - Passenger Tires"),
    ("NIT TERRA GRAPPLER G3 275/60R20XL 116T", "Nitto Terra Grappler G3 - Light Truck Tires"),
])
def test_exact_matches_from_the_report(description, expected, catalog, brands, noise):
    r = run(description, catalog, brands, noise)
    assert r.status == READY and r.tier == "exact"
    assert tire_text(r) == expected


@pytest.mark.parametrize("description, expected", [
    ("GEN GRABBER ATX 265/70R17", "General Grabber A/TX - Light Truck Tires"),    # A/TX written ATX
    ("GEN GRABBER A TX 265/70R17", "General Grabber A/TX - Light Truck Tires"),   # or split
    ("CON TERRAINCONTACT HT 265/70R17", "Continental Terrain Contact H/T - Light Truck Tires"),  # joined
])
def test_spacing_and_punctuation_differences_still_match(description, expected, catalog, brands, noise):
    r = run(description, catalog, brands, noise)
    assert r.status == READY and tire_text(r) == expected


# ------------------------------------------------- T13: word matching, model codes
def test_word_order_does_not_matter(catalog, brands, noise):
    r = run("GEN RT45 ALTIMAX 205/55R16", catalog, brands, noise)
    assert (r.status, r.tier) == (READY, "tokens")
    assert tire_text(r) == "General Altimax RT45 - Passenger Tires"


def test_model_code_mismatch_is_never_accepted(catalog, brands, noise):
    r = run("GEN ALTIMAX RT43 205/55R16", catalog, brands, noise)
    assert r.status == ATTENTION and tire_text(r) == "General Altimax RT45 - Passenger Tires"
    assert "RT43" in r.reason


def test_digits_distinguish_models(catalog, brands, noise):
    eight = run("CON VIKING CONTACT 8 205/55R16", catalog, brands, noise)
    seven = run("CON VIKING CONTACT 7 205/55R16", catalog, brands, noise)
    nine = run("CON VIKING CONTACT 9 205/55R16", catalog, brands, noise)
    assert tire_text(eight) == "Continental Viking Contact 8 - Passenger Tires"
    assert tire_text(seven) == "Continental Viking Contact 7 - Passenger Tires"
    assert nine.status != READY


def test_missing_short_code_needs_attention(catalog, brands, noise):
    r = run("245/55R19 103H NOK ONE BW 80K 245/55R19 103H (80K)", catalog, brands, noise)
    assert r.status == ATTENTION
    assert tire_text(r) == "Nokian One HT - Light Truck Tires"
    assert "HT" in r.reason


def test_missing_descriptive_word_is_fine(catalog, brands, noise):
    """The list says 'Strong Guard ST Trailer', the report only 'STRONG GUARD ST'."""
    r = run("HER STRONG GUARD ST ST205/75R14/8 105/101N", catalog, brands, noise)
    assert r.status == READY and r.tier == "tokens"
    assert tire_text(r) == "Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES"


def test_extra_words_need_attention(catalog, brands, noise):
    r = run("275/55R20XL 117T HER TERRA TRAC AT X-JOURNEY 3PMS 60K", catalog, brands, noise)
    assert r.status == ATTENTION
    assert tire_text(r) == "Hercules Terra Trac A/T - Light Truck Tires"
    assert "X-JOURNEY" in r.reason


def test_a_spelling_slip_in_a_long_word_is_tolerated(catalog, brands, noise):
    r = run("GEN ALTIMAX RT45 205/55R16", catalog, brands, noise)
    assert r.status == READY
    r2 = run("GEN ALTIMAXX RT45 205/55R16", catalog, brands, noise)
    assert r2.status == READY and tire_text(r2) == "General Altimax RT45 - Passenger Tires"


def test_no_brand_code_unique_exact_name_is_ready(catalog, brands, noise):
    r = run("ALTIMAX RT45 205/55R16", catalog, brands, noise)
    assert r.status == READY and r.tier == "exact"


def test_no_brand_code_partial_name_needs_attention(catalog, brands, noise):
    r = run("RT45 205/55R16", catalog, brands, noise)
    assert r.status == ATTENTION
    assert "brand was not recognized" in r.reason


# --------------------------------------------------- T14: routing, not eligible
@pytest.mark.parametrize("description, why", [
    ("ST185/80R13/8 CAR RADIAL TRAIL HD ST185/80R13/8 BW M", "Carlisle is not on the ClaimForm"),
    ("205/40ZR17XL 84W IRON iMOVE GEN 3 AS 40K", "Ironman is not on the ClaimForm"),
    ("305/40R22XL 114H NIT NT420V 305/40R22XL BW 114H", "nothing on the ClaimForm for Nitto"),
    ("255/35ZR19XL 96Y CON EXTREMECONTACT DWS06 PLUS 50K", "nothing on the ClaimForm for Continental"),
    ("205/65R16 95H HER ROADTOUR CONNECT AS BW 55K", "nothing on the ClaimForm for Hercules"),
    ("225/65R17 102H NOK NORDMAN SOLSTICE 4 BW 50K", "nothing on the ClaimForm for Nokian"),
])
def test_not_eligible(description, why, catalog, brands, noise):
    r = run(description, catalog, brands, noise)
    assert r.status == NOT_ELIGIBLE
    assert why in r.reason


def test_attention_comes_with_suggestions(catalog, brands, noise):
    r = run("275/55R20XL 117T HER TERRA TRAC AT X-JOURNEY 3PMS 60K", catalog, brands, noise)
    assert 1 <= len(r.candidates) <= 3
    assert r.candidates[0][0].site_text == "Hercules Terra Trac A/T - Light Truck Tires"


def test_wheels_are_never_matched(catalog, brands, noise):
    r = run("ATD STEEL WHEELS 225/65R17", catalog, brands, noise)
    assert r.item is None or r.item.kind == "tire"


# ------------------------------------------------------ T16: remembered choices
def test_saved_choice_is_used_first(catalog, brands, noise, tmp_path):
    spec = parse_tire("245/55R19 103H NOK ONE BW 80K", brands, noise)
    pm = ProductMap(path=tmp_path / "pm.json")
    pm.remember(spec, "nokian-one-ht-light-truck")
    r = match_tire(spec, catalog, pm)
    assert (r.status, r.tier) == (READY, "saved")
    assert tire_text(r) == "Nokian One HT - Light Truck Tires"


def test_saved_choice_applies_to_the_same_wording_only(catalog, brands, noise, tmp_path):
    pm = ProductMap(path=tmp_path / "pm.json")
    pm.remember(parse_tire("245/55R19 103H NOK ONE BW 80K", brands, noise), "nokian-one-ht-light-truck")
    same = parse_tire("215/70R16 99H NOK ONE 80K", brands, noise)  # other size, same wording
    other = parse_tire("215/70R16 99H NOK ONE X 80K", brands, noise)
    assert match_tire(same, catalog, pm).tier == "saved"
    assert match_tire(other, catalog, pm).tier != "saved"


def test_saved_skip_means_not_eligible(catalog, brands, noise, tmp_path):
    spec = parse_tire("205/40ZR17XL 84W IRON iMOVE GEN 3 AS 40K", brands, noise)
    pm = ProductMap(path=tmp_path / "pm.json")
    pm.remember(spec, None)
    r = match_tire(spec, catalog, pm)
    assert (r.status, r.tier) == (NOT_ELIGIBLE, "saved")


def test_saved_choice_can_override_a_brand_that_is_not_eligible(catalog, brands, noise, tmp_path):
    spec = parse_tire("ST185/80R13/8 CAR RADIAL TRAIL HD", brands, noise)
    pm = ProductMap(path=tmp_path / "pm.json")
    pm.remember(spec, "hercules-strong-guard-st-trailer-boat-trailer")
    assert match_tire(spec, catalog, pm).status == READY


def test_choice_is_kept_but_ignored_when_its_tire_leaves_the_list(catalog, brands, noise, tmp_path):
    spec = parse_tire("245/55R19 103H NOK ONE BW 80K", brands, noise)
    pm = ProductMap(path=tmp_path / "pm.json")
    pm.remember(spec, "nokian-one-ht-light-truck")
    smaller = Catalog(catalog.program, catalog.program_start, catalog.program_end, catalog.imported_on,
                      "smaller", [i for i in catalog.items if i.id != "nokian-one-ht-light-truck"])
    assert pm.sync(smaller) == [signature(spec)]
    entry = pm.get(spec)
    assert entry.inactive and entry.item_id == "nokian-one-ht-light-truck"  # kept
    r = match_tire(spec, smaller, pm)
    assert r.tier != "saved" and any("no longer on the tire list" in n for n in r.notes)
    assert pm.sync(catalog) == [signature(spec)]  # the tire is back
    assert not pm.get(spec).inactive
    assert match_tire(spec, catalog, pm).tier == "saved"


def test_product_map_file_round_trip(app_home, brands, noise):
    spec = parse_tire("245/55R19 103H NOK ONE BW 80K", brands, noise)
    pm = ProductMap.load()
    pm.remember(spec, "nokian-one-ht-light-truck")
    pm.save()
    again = ProductMap.load()
    assert again.get(spec).item_id == "nokian-one-ht-light-truck"
    assert (paths.data_dir() / "product_map.json").is_file()
    assert again.forget(spec)
    again.save()
    assert ProductMap.load().get(spec) is None


def test_signature_ignores_case_spacing_and_size(brands, noise):
    a = parse_tire("245/55R19 103H NOK ONE BW 80K", brands, noise)
    b = parse_tire("nok one 215/70R16 99H", brands, noise)
    assert signature(a) == signature(b) == "nokian|one"


# ----------------------------------------------- T15 and T17: the whole report
EXPECTED_READY = {
    "214288": "Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES",
    "214341": "General Altimax RT45 - Passenger Tires",
    "214533": "Nokian Outpost nAT - Light Truck Tires",
    "214629": "Toyo Open Country A/T III - Light Truck Tires",
    "214632": "Nitto Terra Grappler G3 - Light Truck Tires",
    "214645": "Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES",
    "214659": "Continental SecureContact AW - Passenger Tires",
    "214679": "Nokian Remedy WRG5 - Passenger Tires",
    "214707": "Nokian Remedy WRG5 - Passenger Tires",
    "214725": "Nokian Remedy WRG5 - Passenger Tires",
    "214738": "Falken Aklimate - Passenger Tires",
    "214780": "Falken Aklimate - Passenger Tires",
    "214790": "Nitto Terra Grappler G3 - Light Truck Tires",
    "214983": "Falken Wildpeak A/T4W - Light Truck Tires",
    "215081": "General Altimax RT45 - Passenger Tires",
    "215091": "Toyo Open Country A/T III - Light Truck Tires",
    "215100": "Nitto Terra Grappler G3 - Light Truck Tires",
}


@pytest.fixture(scope="module")
def september(catalog, brands, noise):
    report = parse_report(FIXTURES / "Material-Sales.pdf")
    unmerged = match_report(report, catalog, brands, noise)
    return unmerged, merge_rows(unmerged)


def test_unmerged_has_one_entry_per_tire_row(september):
    assert len(september[0]) == 29


def test_merging_split_rows(september):
    merged = september[1]
    assert len(merged) == 26
    by_invoice = {m.invoice: m for m in merged}
    for invoice in ("214962", "215024", "215091"):
        assert by_invoice[invoice].merged and len(by_invoice[invoice].rows) == 2
        assert by_invoice[invoice].qty == 4
    assert sum(m.merged for m in merged) == 3
    assert sum(m.qty for m in merged) == 87  # nothing lost


def test_ready_rows_are_exactly_the_expected_tires(september):
    ready = {m.invoice: m.result.item.site_text for m in september[1] if m.status == READY}
    assert ready == EXPECTED_READY


def test_attention_and_not_eligible_invoices(september):
    merged = september[1]
    assert {m.invoice for m in merged if m.status == ATTENTION} == {"214655", "214962"}
    assert {m.invoice for m in merged if m.status == NOT_ELIGIBLE} == {
        "214354", "214502", "214633", "214698", "214745", "214852", "215024"}


def test_quantities_by_status(september):
    merged = september[1]
    qty = lambda s: sum(m.qty for m in merged if m.status == s)
    assert (qty(READY), qty(ATTENTION), qty(NOT_ELIGIBLE)) == (60, 8, 19)


def _row(invoice, description, qty, brands, noise, catalog, day=date(2026, 9, 5)):
    row = SaleRow(day, invoice, description, qty)
    spec = parse_tire(description, brands, noise)
    return MatchedRow([row], spec, match_tire(spec, catalog))


def test_merge_only_same_invoice_and_same_tire(catalog, brands, noise):
    a = "225/65R17 102H CON SECURECONTACT AW BW 60K"
    b = "205/60R16 92V FAL AKLIMATE BW 65K"
    rows = [_row("1", a, 1, brands, noise, catalog), _row("1", a, 3, brands, noise, catalog),
            _row("1", b, 2, brands, noise, catalog), _row("2", a, 4, brands, noise, catalog)]
    merged = merge_rows(rows)
    assert [(m.invoice, m.qty) for m in merged] == [("1", 4), ("1", 2), ("2", 4)]
    assert len(rows) == 4 and rows[0].qty == 1  # the inputs are not changed


def test_two_wordings_of_one_tire_merge(catalog, brands, noise):
    rows = [_row("1", "205/60R16 92V FAL AKLIMATE BW", 2, brands, noise, catalog),
            _row("1", "FAL AKLIMATE 205/60R16", 2, brands, noise, catalog)]
    assert [(m.invoice, m.qty) for m in merge_rows(rows)] == [("1", 4)]


# ------------------------------------------------------------------------- CLI
CLAIMFORM = str(FIXTURES / "ClaimForm.pdf")
REPORT = str(FIXTURES / "Material-Sales.pdf")


def test_cli_match_tire(app_home, capsys):
    assert main(["match-tire", "235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)",
                 "--claimform", CLAIMFORM]) == 0
    out = capsys.readouterr().out
    assert "Result:      READY (exact)" in out
    assert "Tire:        General Altimax RT45 - Passenger Tires" in out


def test_cli_match_tire_attention(app_home, capsys):
    main(["match-tire", "245/55R19 103H NOK ONE BW 80K", "--claimform", CLAIMFORM])
    out = capsys.readouterr().out
    assert "NEEDS ATTENTION" in out and "Best guess:  Nokian One HT - Light Truck Tires" in out


def test_cli_match_tire_without_a_saved_list(app_home, capsys):
    assert main(["match-tire", "GEN ALTIMAX RT45"]) == 1
    assert "No tire list has been saved" in capsys.readouterr().out


def test_cli_match_report_counts(app_home, capsys):
    assert main(["match-report", REPORT, "--claimform", CLAIMFORM]) == 0
    out = capsys.readouterr().out
    assert "29  ->  26 after merging" in out
    assert "Ready:            17 rows, qty 60" in out
    assert "Needs attention:   2 rows, qty 8" in out
    assert "Not eligible:      7 rows, qty 19" in out
    assert "Total qty:        87" in out


def test_cli_resolve_changes_the_report(app_home, capsys):
    tire = "Nokian One HT - Light Truck Tires"
    assert main(["resolve", "245/55R19 103H NOK ONE BW 80K", "--tire", tire,
                 "--claimform", CLAIMFORM]) == 0
    assert "Saved:" in capsys.readouterr().out
    main(["match-report", REPORT, "--claimform", CLAIMFORM])
    out = capsys.readouterr().out
    assert "Ready:            18 rows, qty 64" in out
    assert "Needs attention:   1 rows, qty 4" in out
    main(["match-report", REPORT, "--claimform", CLAIMFORM, "--no-saved"])
    assert "Ready:            17 rows" in capsys.readouterr().out  # --no-saved ignores the file


def test_cli_resolve_skip_and_forget(app_home, capsys):
    desc = "275/55R20XL 117T HER TERRA TRAC AT X-JOURNEY 3PMS 60K"
    assert main(["resolve", desc, "--skip", "--claimform", CLAIMFORM]) == 0
    main(["match-report", REPORT, "--claimform", CLAIMFORM])
    out = capsys.readouterr().out
    assert "Needs attention:   1 rows" in out and "Not eligible:      8 rows" in out
    assert main(["resolve", desc, "--forget", "--claimform", CLAIMFORM]) == 0
    main(["match-report", REPORT, "--claimform", CLAIMFORM])
    assert "Needs attention:   2 rows" in capsys.readouterr().out


def test_cli_resolve_rejects_a_tire_not_on_the_list(app_home, capsys):
    assert main(["resolve", "245/55R19 103H NOK ONE", "--tire", "Nokian One - Light Truck Tires",
                 "--claimform", CLAIMFORM]) == 1
    out = capsys.readouterr().out
    assert "not on the tire list" in out and "did you mean: Nokian One HT" in out
    assert not (paths.data_dir() / "product_map.json").exists()


def test_cli_match_report_with_the_saved_list(app_home, capsys):
    main(["catalog-import", CLAIMFORM, "--save"])
    capsys.readouterr()
    assert main(["match-report", REPORT]) == 0
    assert "Ready:            17 rows, qty 60" in capsys.readouterr().out
