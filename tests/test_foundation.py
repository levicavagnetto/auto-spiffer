from datetime import date

from auto_spiffer import __version__, paths
from auto_spiffer.cli import main
from auto_spiffer.models import CatalogItem, ClaimRow, SaleRow


def test_version_is_set():
    assert __version__ == "0.1.0"


def test_fixtures_are_present(fixtures):
    for name in ("Material-Sales.pdf", "ClaimForm.pdf", "example_invoice.pdf",
                 "ATD ProRewards - Submit Claim.html"):
        assert (fixtures / name).is_file(), name


def test_paths_use_override(app_home):
    assert paths.app_dir() == app_home
    assert paths.data_dir() == app_home / "data"


def test_ensure_dirs_creates_folders(app_home):
    folders = paths.ensure_dirs()
    assert [f.name for f in folders] == ["data", "history", "months", "output"]
    assert all(f.is_dir() for f in folders)


def test_paths_command_runs(app_home, capsys):
    assert main(["paths"]) == 0
    out = capsys.readouterr().out
    assert "App folder:" in out
    assert (app_home / "data" / "history").is_dir()


def test_sale_row_tire_flag():
    row = SaleRow(date(2026, 9, 5), "214341", "GEN AltiMAX RT45", 4)
    assert row.is_tire
    row.ignored_reason = "shipping"
    assert not row.is_tire


def test_claim_row_date_format():
    row = ClaimRow(date(2026, 9, 5), "214341", "General Altimax RT45 - Passenger Tires", 4)
    assert row.sale_date_str == "09/05/2026"
    assert row.status == "ready"


def test_catalog_item_round_trip():
    item = CatalogItem(
        id="general-altimax-rt45-passenger",
        site_text="General Altimax RT45 - Passenger Tires",
        brand="General", model="Altimax RT45", category="Passenger", unit_value=3.0,
    )
    assert CatalogItem.from_dict(item.to_dict()) == item
