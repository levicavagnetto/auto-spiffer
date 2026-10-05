import json
import re
import shutil
from dataclasses import replace
from datetime import date
from pathlib import Path

import pytest

from auto_spiffer import paths
from auto_spiffer.brands import BrandTable
from auto_spiffer.catalog import save_catalog
from auto_spiffer.catalog_import import parse_claimform
from auto_spiffer.demo_pdfs import make_demo_invoices, make_invoice_pdf
from auto_spiffer.report_parse import ReportError, parse_report
from auto_spiffer.session import MAX_QTY, EXCLUDED, Session, row_key
from auto_spiffer.settings import Settings
from auto_spiffer.tirespec import NoiseRules
from auto_spiffer.workspace import (Workspace, copy_report, list_workspaces, month_key, sync_invoices,
                                    workspace_for)

FIXTURES = Path(__file__).parent / "fixtures"
REPORT = FIXTURES / "Material-Sales.pdf"
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
    return NoiseRules(words={"BW", "M", "XL", "RF", "SL", "OWL", "RWL", "WL", "3PMS", "3PMSF", "M+S", "M/S", "MS"},
                      patterns=[re.compile(r"^\d{1,2}PR$", re.IGNORECASE)])


@pytest.fixture(scope="module")
def october():
    class Names:
        claimform_names = BRAND_NAMES
    return parse_claimform(FIXTURES / "ClaimForm.pdf", brands=Names()).catalog


@pytest.fixture(scope="module")
def september_list(october):
    return replace(october, program="September 2026 Pro Rewards",
                   program_start=date(2026, 9, 1), program_end=date(2026, 9, 30))


@pytest.fixture
def invoice_folder(tmp_path):
    folder = tmp_path / "inv"
    make_demo_invoices(parse_report(REPORT), folder, count=100)
    return folder


@pytest.fixture
def session(app_home, brands, noise, september_list):
    s = Session(brands=brands, noise=noise, load_saved=False)
    s.catalog = september_list
    return s


@pytest.fixture
def loaded(session, invoice_folder):
    session.set_report(REPORT)
    session.add_invoice_paths([invoice_folder])
    session.read()
    return session


# ------------------------------------------------------------------- inputs
def test_set_report_ok_and_error(session, fixtures):
    assert session.set_report(REPORT) is not None and session.report_error is None
    assert len(session.report.rows) == 32
    assert session.set_report(fixtures / "example_invoice.pdf") is None
    assert "Material Sales" in session.report_error
    assert session.set_report(REPORT / "nope.pdf") is None and "not found" in session.report_error


def test_add_invoice_paths_expands_folders_and_dedupes(session, invoice_folder):
    assert session.add_invoice_paths([invoice_folder]) == 27
    assert session.add_invoice_paths([invoice_folder]) == 0
    one = invoice_folder / "invoice_214341.pdf"
    assert session.add_invoice_paths([one]) == 0
    (invoice_folder / "notes.txt").write_text("x")
    assert session.add_invoice_paths([invoice_folder]) == 0  # only PDFs


def test_remove_and_clear_invoices(session, invoice_folder):
    session.add_invoice_paths([invoice_folder])
    session.remove_invoice_paths([invoice_folder / "invoice_214341.pdf"])
    assert len(session.invoice_paths) == 26 and session.invoice_preview is None
    session.clear_invoices()
    assert session.invoice_paths == []


def test_invoice_preview_and_missing_numbers(session, tmp_path):
    session.set_report(REPORT)
    folder = tmp_path / "few"
    make_demo_invoices(session.report, folder, count=3)
    session.add_invoice_paths([folder])
    assert session.preview_missing_invoices() == []  # not checked yet
    index = session.refresh_invoice_preview()
    assert len(index.pdfs) == 4  # three plus the stray one
    missing = session.preview_missing_invoices()
    assert "214341" not in missing and "214629" in missing and len(missing) == 23


# -------------------------------------------------------------- readiness
def test_can_read_reasons(app_home, brands, noise, october, september_list):
    s = Session(brands=brands, noise=noise, load_saved=False)
    assert s.can_read() == (False, "Choose the Material Sales report first.")
    s.set_report(FIXTURES / "example_invoice.pdf")
    assert not s.can_read()[0] and "Material Sales" in s.can_read()[1]
    s.set_report(REPORT)
    assert s.can_read() == (False, "Load a tire list (ClaimForm.pdf) first.")
    s.catalog = october
    ok, reason = s.can_read()
    assert not ok and "different month" in reason
    assert not s.program_check().ok
    s.decisions.override_program_mismatch = True
    assert s.can_read() == (True, "")
    s.catalog = september_list
    s.decisions.override_program_mismatch = False
    assert s.can_read() == (True, "")


def test_read_refuses_when_not_ready(session):
    with pytest.raises(ReportError):
        session.read()


# -------------------------------------------------------------- workspaces
def test_read_makes_the_month_workspace(loaded):
    ws = loaded.workspace
    assert ws.month == "2026-09" and ws.label == "September 2026"
    assert ws.path == paths.months_dir() / "2026-09"
    assert ws.report_file.is_file() and ws.meta_file.is_file() and ws.decisions_file.is_file()
    assert len(list(ws.invoices_dir.glob("*.pdf"))) == 27
    assert ws.read_meta()["report_name"] == "Material-Sales.pdf"
    assert loaded.result is not None and len(loaded.rows) == 26


def test_originals_are_not_touched(session, invoice_folder):
    before = sorted(p.name for p in invoice_folder.iterdir())
    session.set_report(REPORT)
    session.add_invoice_paths([invoice_folder])
    session.read()
    assert sorted(p.name for p in invoice_folder.iterdir()) == before
    assert REPORT.is_file()


def test_month_key_and_listing(app_home, session):
    session.set_report(REPORT)
    assert month_key(session.report) == "2026-09"
    assert list_workspaces() == []
    ws = workspace_for(session.report)
    assert list_workspaces() == []  # not listed until it has been written to
    ws.write_meta(report_name="x")
    other = Workspace(paths.months_dir() / "2026-08").ensure()
    other.write_meta(report_name="y")
    assert [w.month for w in list_workspaces()] == ["2026-09", "2026-08"]


def test_sync_invoices_removes_deselected_and_renames_conflicts(app_home, tmp_path):
    ws = Workspace(paths.months_dir() / "2026-09").ensure()
    a = make_invoice_pdf(tmp_path / "a.pdf", "100001", date(2026, 9, 1), "X 235/50R18")
    b = make_invoice_pdf(tmp_path / "b.pdf", "100002", date(2026, 9, 1), "X 235/50R18")
    assert [p.name for p in sync_invoices(ws, [a, b])] == ["a.pdf", "b.pdf"]
    # a different file with the same name does not overwrite
    other = tmp_path / "elsewhere"
    other.mkdir()
    a2 = make_invoice_pdf(other / "a.pdf", "100003", date(2026, 9, 1), "Y 235/50R18 extra")
    names = [p.name for p in sync_invoices(ws, [a, a2])]
    assert names == ["a-2.pdf", "a.pdf"]
    assert sorted(p.name for p in ws.invoices_dir.iterdir()) == ["a-2.pdf", "a.pdf"]  # b was removed


def test_copy_report_onto_itself_is_fine(app_home, session):
    session.set_report(REPORT)
    ws = workspace_for(session.report)
    copy_report(ws, REPORT)
    copy_report(ws, ws.report_file)
    assert ws.report_file.read_bytes() == REPORT.read_bytes()


# -------------------------------------------------------- rows and decisions
def test_counts(loaded):
    assert loaded.counts() == {"ready": (17, 60), "attention": (2, 8), "not_eligible": (7, 19)}
    assert len(loaded.to_enter()) == 17


def test_resolve_and_remember(loaded):
    index = next(i for i, r in enumerate(loaded.rows) if r.invoice == "214655")
    item = loaded.catalog.find_by_text("Nokian One HT - Light Truck Tires")
    loaded.resolve(index, item, remember=True)
    assert loaded.counts()["ready"] == (18, 64) and loaded.counts()["attention"] == (1, 4)
    assert "nokian|one" in json.loads(loaded.product_map.path.read_text())["entries"]


def test_resolve_without_remembering_is_forgotten_next_month(loaded):
    index = next(i for i, r in enumerate(loaded.rows) if r.invoice == "214655")
    item = loaded.catalog.find_by_text("Nokian One HT - Light Truck Tires")
    loaded.resolve(index, item, remember=False)
    assert loaded.counts()["ready"] == (18, 64)
    assert not loaded.product_map.path.exists() or "nokian|one" not in loaded.product_map.path.read_text()
    loaded.temp_choices.entries.clear()
    loaded.analyze()
    assert loaded.counts()["attention"] == (2, 8)


def test_resolve_not_eligible(loaded):
    index = next(i for i, r in enumerate(loaded.rows) if r.invoice == "214962")
    loaded.resolve(index, None)
    assert loaded.counts()["attention"] == (1, 4) and loaded.counts()["not_eligible"] == (8, 23)


def test_set_qty_and_bounds(loaded):
    index = next(i for i, r in enumerate(loaded.rows) if r.invoice == "214341")
    loaded.set_qty(index, 3)
    row = loaded.rows[index]
    assert row.qty == 3 and any("changed from 4 to 3" in n for n in row.notes)
    assert loaded.counts()["ready"] == (17, 59)
    loaded.set_qty(index, 4)  # back to the original: the override disappears
    assert loaded.decisions.qty == {}
    for bad in (0, -1, MAX_QTY + 1):
        with pytest.raises(ValueError):
            loaded.set_qty(index, bad)


def test_exclude_and_include(loaded):
    index = next(i for i, r in enumerate(loaded.rows) if r.invoice == "214341")
    loaded.exclude(index)
    assert loaded.rows[index].status == EXCLUDED and loaded.is_excluded(index)
    assert loaded.counts()["ready"] == (16, 56)
    loaded.include(index)
    assert loaded.rows[index].status == "ready" and not loaded.is_excluded(index)


def test_skip_unresolved(loaded):
    assert not loaded.can_continue() and "2 line(s) still need" in loaded.continue_blockers()[0]
    loaded.set_skip_unresolved(True)
    assert loaded.counts()["excluded"] == (2, 8) and "attention" not in loaded.counts()
    assert loaded.can_continue() and loaded.continue_blockers() == []


def test_continue_after_resolving_both(loaded):
    for invoice, tire in (("214655", "Nokian One HT - Light Truck Tires"),
                          ("214962", "Hercules Terra Trac A/T - Light Truck Tires")):
        index = next(i for i, r in enumerate(loaded.rows) if r.invoice == invoice)
        loaded.resolve(index, loaded.catalog.find_by_text(tire))
    assert loaded.can_continue()
    assert loaded.counts()["ready"] == (19, 68)


def test_nothing_ready_blocks_continue(loaded):
    for i in range(len(loaded.rows)):
        loaded.exclude(i)
    loaded.set_skip_unresolved(True)
    assert loaded.continue_blockers() == ["Nothing is ready to enter."]


def test_decisions_survive_reopening_the_month(loaded, brands, noise, september_list):
    i = next(i for i, r in enumerate(loaded.rows) if r.invoice == "214341")
    loaded.exclude(i)
    j = next(i for i, r in enumerate(loaded.rows) if r.invoice == "214533")
    loaded.set_qty(j, 2)
    loaded.set_skip_unresolved(True)
    ws = loaded.workspace

    again = Session(brands=brands, noise=noise, load_saved=False)
    again.catalog = september_list
    again.open_workspace(ws)
    assert again.workspace.month == "2026-09" and len(again.invoice_paths) == 27
    assert again.decisions.skip_unresolved
    assert again.counts()["ready"] == (16, 54)  # 17 minus the excluded sale, and one quantity lowered by 2
    kinds = {r.invoice: r for r in again.rows}
    assert kinds["214341"].status == EXCLUDED and kinds["214533"].qty == 2


def test_result_for_report_has_the_decisions(loaded):
    loaded.exclude(next(i for i, r in enumerate(loaded.rows) if r.invoice == "214341"))
    result = loaded.result_for_report()
    assert len(result.to_enter) == 16 and result.qty_to_enter == 56
    assert len(loaded.result.to_enter) == 17  # the underlying analysis is untouched


def test_row_key_ignores_spacing_and_case(loaded):
    row = loaded.result.claim_rows[0]
    assert row_key(row) == row_key(replace(row, description=row.description.lower().replace(" ", "  ")))


def test_set_catalog_rematches(loaded, october, september_list):
    smaller = replace(september_list, items=[i for i in september_list.items
                                              if i.site_text != "General Altimax RT45 - Passenger Tires"])
    loaded.set_catalog(smaller)
    counts = loaded.counts()
    assert counts["ready"][0] == 15  # the two Altimax RT45 sales are no longer settled...
    assert counts["attention"][0] == 4  # ...they are held for a decision, not silently dropped
    assert counts["not_eligible"][0] == 7


def test_blocked_month_has_no_rows(app_home, brands, noise, october, invoice_folder):
    s = Session(brands=brands, noise=noise, load_saved=False)
    s.catalog = october
    s.set_report(REPORT)
    s.add_invoice_paths([invoice_folder])
    s.decisions.override_program_mismatch = True
    s.read()
    ws = s.workspace
    s.decisions.override_program_mismatch = False
    s.save_decisions()
    again = Session(brands=brands, noise=noise, load_saved=False)
    again.catalog = october
    again.open_workspace(ws)
    assert again.result.blocked and again.rows == []
    assert again.continue_blockers() == [again.result.program_check.message]


def test_reset_starts_a_new_month(loaded):
    loaded.reset()
    assert loaded.report is None and loaded.workspace is None and loaded.result is None
    assert loaded.rows == [] and loaded.catalog is not None


# ----------------------------------------------------------------- settings
def test_settings_defaults_save_and_damaged_file(tmp_path):
    path = tmp_path / "settings.json"
    s = Settings.load(path)
    assert s.get("window_geometry") == "1260x720" and s.get("last_workspace") == ""
    s.set("last_workspace", "2026-09")
    s.save()
    assert Settings.load(path).get("last_workspace") == "2026-09"
    path.write_text("{ not json")
    assert Settings.load(path).get("last_workspace") == ""
    assert Settings.load(tmp_path / "missing.json").get("window_geometry") == "1260x720"


# ------------------------------------------------- invoice PDFs are optional
def test_no_invoice_pdfs_means_sales_only(session):
    session.set_report(REPORT)
    session.read()  # no invoice PDFs chosen at all
    assert not session.uses_pdfs
    assert session.counts() == {"ready": (17, 60), "attention": (2, 8), "not_eligible": (7, 19)}
    assert all(r.pdf_path is None for r in session.rows)
    assert session.result.links is None and session.result.index is None
    assert session.can_read() == (True, "")


def test_pdfs_can_be_ignored_even_when_loaded(session, invoice_folder):
    session.use_pdfs = False
    session.set_report(REPORT)
    session.add_invoice_paths([invoice_folder])
    session.read()
    assert not session.uses_pdfs
    assert session.counts()["ready"] == (17, 60) and all(r.pdf_path is None for r in session.rows)
    session.use_pdfs = True
    session.analyze()
    assert session.uses_pdfs and all(r.pdf_path for r in session.rows if r.status == "ready")


def test_some_pdfs_still_hold_back_sales_without_one(session, tmp_path):
    session.set_report(REPORT)
    few = tmp_path / "few"
    make_demo_invoices(session.report, few, count=3)
    session.add_invoice_paths([few])
    session.read()
    assert session.uses_pdfs
    assert session.counts()["ready"][0] == 2 and session.counts()["problem"][0] == 15  # 214288 and 214341 have one
    session.allow_missing_pdf = True
    session.analyze()
    assert session.counts()["ready"][0] == 17


def test_removing_every_pdf_goes_back_to_sales_only(session, invoice_folder):
    session.set_report(REPORT)
    session.add_invoice_paths([invoice_folder])
    session.read()
    assert session.uses_pdfs
    session.clear_invoices()
    session.read()  # the workspace copies are removed too
    assert not session.uses_pdfs and session.counts()["ready"] == (17, 60)


# ------------------------------------------------------- re-enter this month
def record_entries(*invoices, other="999001"):
    """Pretend some lines were entered (and one PDF uploaded), plus one line from another month."""
    from auto_spiffer.state import State, state_path_for_test_mode
    state = State.load()
    tires = {"214341": "General Altimax RT45 - Passenger Tires", "214533": "Nokian Outpost nAT - Light Truck Tires"}
    for invoice in invoices:
        state.mark_entered(invoice, tires[invoice], 4, "09/05/2026")
        state.mark_uploaded("hash-" + invoice, f"invoice_{invoice}.pdf", invoice)
    state.mark_entered(other, "Falken Aklimate - Passenger Tires", 4, "08/05/2026")  # another month
    state.save()
    practice = State.load(state_path_for_test_mode())
    practice.mark_entered(invoices[0], "x", 1, "09/05/2026")
    practice.save()


def test_entered_records_are_those_of_this_months_invoices(loaded):
    assert loaded.entered_records() == []
    record_entries("214341", "214533")
    assert sorted(e.invoice for e in loaded.entered_records()) == ["214341", "214533"]  # not 999001


def test_recorded_lines_show_as_already_entered_and_keep_run_reachable(loaded):
    record_entries("214341")
    loaded.analyze()
    assert loaded.counts()["already_entered"] == (1, 4) and loaded.counts()["ready"] == (16, 56)
    # when EVERY ready line is recorded, the Run page must stay reachable, or the button could not be used
    from auto_spiffer.state import State
    state = State.load()
    for r in loaded.result.claim_rows:
        if r.status == "ready":
            state.mark_entered(r.invoice, r.product_text, r.qty, "x")
    state.save()
    loaded.set_skip_unresolved(True)
    loaded.analyze()
    assert loaded.counts().get("ready") is None and loaded.runnable() == []
    assert loaded.continue_blockers() == []


def test_reenter_month_forgets_only_this_month_and_makes_lines_ready_again(loaded):
    from auto_spiffer.state import State, state_path_for_test_mode
    record_entries("214341", "214533")
    loaded.analyze()
    loaded.run_results["x|y"] = ("entered", "")
    assert loaded.counts()["already_entered"][0] == 2
    removed = loaded.reenter_month()
    assert removed == 4  # two entered records and two upload records
    assert loaded.counts()["ready"] == (17, 60) and "already_entered" not in loaded.counts()
    assert loaded.run_results == {} and loaded.entered_records() == []
    state = State.load()
    assert [e.invoice for e in state.entered] == ["999001"]  # the other month is untouched
    assert state.uploaded == []
    assert State.load(state_path_for_test_mode()).entered == []  # the test-mode record went too


def test_reenter_with_nothing_open_does_nothing(session):
    assert session.entered_records() == [] and session.reenter_month() == 0
