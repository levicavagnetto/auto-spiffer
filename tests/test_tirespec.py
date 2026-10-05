import random
import re

import pytest

from auto_spiffer import paths
from auto_spiffer.brands import BrandTable, load_brands
from auto_spiffer.cli import main
from auto_spiffer.report_parse import parse_report
from auto_spiffer.sizes import has_tire_size
from auto_spiffer.tirespec import NoiseRules, load_noise, parse_tire


@pytest.fixture(scope="module")
def brands():
    return BrandTable(
        claimform={"CON": "Continental", "FAL": "Falken", "GEN": "General", "HER": "Hercules",
                   "NIT": "Nitto", "NOK": "Nokian", "TOY": "Toyo"},
        other={"CAR": "Carlisle", "FST": "FST", "IRON": "Ironman"},
    )


@pytest.fixture(scope="module")
def noise():
    return NoiseRules(
        words={"BW", "M", "XL", "RF", "SL", "OWL", "RWL", "WL", "3PMS", "3PMSF", "M+S", "M/S", "MS"},
        patterns=[re.compile(r"^\d{1,2}PR$", re.IGNORECASE)],
    )


def spec(description, brands, noise):
    return parse_tire(description, brands, noise)


# ------------------------------------------------------------ T6: strip the extras
def test_first_example_from_the_plan(brands, noise):
    s = spec("235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)", brands, noise)
    assert s.sizes == ["235/50R18", "235/50R18"]
    assert s.load_speed == ["97H", "97H"]
    assert s.warranties == ["65K", "65K"]
    assert s.noise == ["BW"]
    assert s.words == ["AltiMAX", "RT45"]


def test_brand_first_and_size_last(brands, noise):
    s = spec("NIT TERRA GRAPPLER G3 275/60R20XL 116T", brands, noise)
    assert s.sizes == ["275/60R20XL"]
    assert s.load_speed == ["116T"]
    assert s.words == ["TERRA", "GRAPPLER", "G3"]


def test_flotation_size_with_ply_and_repeat(brands, noise):
    s = spec("LT37X12.50R20/10 126Q TOY OPEN COUNTRY A/T III BW 50K LT37X12.50R20/10 BW 126Q (50K)",
             brands, noise)
    assert s.sizes == ["LT37X12.50R20/10", "LT37X12.50R20/10"]
    assert s.words == ["OPEN", "COUNTRY", "A/T", "III"]


def test_model_codes_that_look_like_ratings_are_kept(brands, noise):
    assert spec("305/40R22XL 114H NIT NT420V 305/40R22XL BW 114H", brands, noise).words == ["NT420V"]
    assert spec("GEN ALTIMAX 365AW 205/55R16 91H", brands, noise).words == ["ALTIMAX", "365AW"]
    assert spec("FAL WILDPEAK A/T4W 265/70R16 112T", brands, noise).words == ["WILDPEAK", "A/T4W"]


def test_plain_numbers_in_model_names_are_kept(brands, noise):
    assert spec("225/65R17 102H NOK NORDMAN SOLSTICE 4 BW 50K 225/65R17 BW 102H (50K)",
                brands, noise).words == ["NORDMAN", "SOLSTICE", "4"]


def test_ply_rating_is_noise(brands, noise):
    s = spec("LT265/75R16 123/120S 10PR NOK OUTPOST NAT", brands, noise)
    assert "10PR" in s.noise and "10PR" not in s.words


@pytest.mark.parametrize("description", [
    "235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)",
    "LT265/75R16/10 123/120S NOK OUTPOST NAT BW 60K LT265/75R16/10 BW 123/120S (60K)",
    "35X12.5R18LT/12 128R NIT TERRA GRAPPLER G3 BW 55K 35X12.50R18LT/12 BW 128R (55K)",
])
def test_order_does_not_matter(description, brands, noise):
    """Shuffling the pieces of a description must not change what the parser finds."""
    expected = spec(description, brands, noise)
    pieces = description.split()
    rng = random.Random(7)
    for _ in range(15):
        rng.shuffle(pieces)  # sizes contain no spaces, so shuffling words keeps every size intact
        s = spec(" ".join(pieces), brands, noise)
        assert sorted(w.upper() for w in s.words) == sorted(w.upper() for w in expected.words)
        assert s.brand == expected.brand
        assert sorted(s.sizes) == sorted(expected.sizes)


# ------------------------------------------------------------------- T7: brands
def test_brand_codes_map_to_claimform_names(brands, noise):
    s = spec("HER STRONG GUARD ST ST205/75R14/8 105/101N", brands, noise)
    assert (s.brand.name, s.brand.on_claimform, s.brand_code) == ("Hercules", True, "HER")
    assert s.words == ["STRONG", "GUARD", "ST"]
    assert s.sizes == ["ST205/75R14/8"]
    assert s.load_speed == ["105/101N"]


def test_ironman_gen_3_is_not_general(brands, noise):
    s = spec("205/40ZR17XL 84W IRON iMOVE GEN 3 AS 40K 205/40ZR17XL BW 84W (40K)", brands, noise)
    assert s.brand.name == "Ironman"
    assert not s.brand.on_claimform
    assert s.words == ["iMOVE", "GEN", "3", "AS"]
    assert any("GEN" in n for n in s.notes)


def test_two_claimform_brands_is_ambiguous(brands, noise):
    s = spec("225/65R17 GEN HER MYSTERY 102H", brands, noise)
    assert s.brand is None
    assert {b.name for b in s.brand_candidates} == {"General", "Hercules"}
    assert "GEN" in s.words and "HER" in s.words


def test_no_brand_code_gives_none(brands, noise):
    s = spec("225/65R17 102H MYSTERY TIRE", brands, noise)
    assert s.brand is None and s.brand_candidates == []
    assert s.words == ["MYSTERY", "TIRE"]


def test_whole_words_only(brands, noise):
    """CONNECT is not CON."""
    s = spec("205/65R16 95H HER ROADTOUR CONNECT AS BW 55K", brands, noise)
    assert s.brand.name == "Hercules"
    assert s.words == ["ROADTOUR", "CONNECT", "AS"]


def test_full_brand_names_work_as_codes(brands, noise):
    assert spec("225/65R17 FALKEN AKLIMATE", brands, noise).brand.name == "Falken"


def test_code_is_case_insensitive(brands, noise):
    assert spec("225/65r17 gen altimax rt45", brands, noise).brand.name == "General"


# --------------------------------------------------------- the editable files
def test_default_files_are_copied_to_data_folder(app_home):
    load_brands()
    load_noise()
    assert (paths.data_dir() / "brands.toml").is_file()
    assert (paths.data_dir() / "noise.toml").is_file()


def test_edited_brands_file_is_used(app_home):
    path = paths.ensure_data_file("brands.toml")
    path.write_text('[claimform]\nPIR = "Pirelli"\n[other]\n', encoding="utf-8")
    assert load_brands().lookup("pir").name == "Pirelli"


def test_default_brands_cover_the_september_report(app_home):
    table = load_brands()
    for code in ("GEN", "HER", "CON", "NOK", "TOY", "NIT", "FAL"):
        assert table.lookup(code).on_claimform
    for code in ("CAR", "FST", "IRON"):
        assert not table.lookup(code).on_claimform


# ------------------------------------------- T8: the real September report rows
EXPECTED = [  # (invoice, brand name, on the ClaimForm, model words) for the 29 tire rows
    ("214288", "Hercules", True, "STRONG GUARD ST"),
    ("214341", "General", True, "AltiMAX RT45"),
    ("214354", "Carlisle", False, "RADIAL TRAIL HD"),
    ("214502", "Continental", True, "EXTREMECONTACT DWS06 PLUS"),
    ("214533", "Nokian", True, "OUTPOST NAT"),
    ("214629", "Toyo", True, "OPEN COUNTRY A/T III"),
    ("214632", "Nitto", True, "TERRA GRAPPLER G3"),
    ("214633", "Nitto", True, "NT420V"),
    ("214645", "Hercules", True, "STRONG GUARD ST"),
    ("214655", "Nokian", True, "ONE"),
    ("214659", "Continental", True, "SECURECONTACT AW"),
    ("214679", "Nokian", True, "REMEDY WRG5"),
    ("214698", "Carlisle", False, "RADIAL TRAIL HD"),
    ("214707", "Nokian", True, "REMEDY WRG5"),
    ("214725", "Nokian", True, "REMEDY WRG5"),
    ("214738", "Falken", True, "AKLIMATE"),
    ("214745", "Ironman", False, "iMOVE GEN 3 AS"),
    ("214780", "Falken", True, "AKLIMATE"),
    ("214790", "Nitto", True, "TERRA GRAPPLER G3"),
    ("214852", "Hercules", True, "ROADTOUR CONNECT AS"),
    ("214962", "Hercules", True, "TERRA TRAC AT X-JOURNEY"),
    ("214962", "Hercules", True, "TERRA TRAC AT X-JOURNEY"),
    ("214983", "Falken", True, "WILDPEAK A/T4W"),
    ("215024", "Nokian", True, "NORDMAN SOLSTICE 4"),
    ("215024", "Nokian", True, "NORDMAN SOLSTICE 4"),
    ("215081", "General", True, "AltiMAX RT45"),
    ("215091", "Toyo", True, "OPEN COUNTRY A/T III"),
    ("215091", "Toyo", True, "OPEN COUNTRY A/T III"),
    ("215100", "Nitto", True, "TERRA GRAPPLER G3"),
]


def test_every_september_row(fixtures, app_home):
    report = parse_report(fixtures / "Material-Sales.pdf")
    brands, noise = load_brands(), load_noise()
    rows = report.tire_rows
    assert len(rows) == len(EXPECTED) == 29
    for row, (invoice, brand, on_form, words) in zip(rows, EXPECTED):
        s = parse_tire(row.description, brands, noise)
        assert row.invoice == invoice
        assert s.brand is not None, row.description
        assert (s.brand.name, s.brand.on_claimform, " ".join(s.words)) == (brand, on_form, words), \
            row.description
        assert s.sizes, row.description  # every tire row had at least one size
        assert not has_tire_size(" ".join(s.words))
        assert "BW" not in [w.upper() for w in s.words]


# ------------------------------------------------------------------------ CLI
def test_parse_tire_command(app_home, capsys):
    assert main(["parse-tire", "235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)"]) == 0
    out = capsys.readouterr().out
    assert "Brand:       GEN -> General" in out
    assert "Warranty:    65K, 65K" in out
    assert "Words:       AltiMAX, RT45" in out


def test_parse_tire_command_ironman(app_home, capsys):
    main(["parse-tire", "205/40ZR17XL 84W IRON iMOVE GEN 3 AS 40K"])
    out = capsys.readouterr().out
    assert "IRON -> Ironman  (not on the ClaimForm)" in out
    assert "Words:       iMOVE, GEN, 3, AS" in out


def test_parse_report_command(fixtures, app_home, capsys):
    assert main(["parse-report", str(fixtures / "Material-Sales.pdf")]) == 0
    out = capsys.readouterr().out
    assert "Tire rows:                  29" in out
    assert "Rows with no brand found:   0" in out
    assert "Rows with a size left over: 0" in out
