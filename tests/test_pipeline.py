import ast
import csv
import re
from dataclasses import replace
from datetime import date, datetime
from pathlib import Path

import pytest

from auto_spiffer import paths
from auto_spiffer.brands import BrandTable
from auto_spiffer.catalog_import import parse_claimform
from auto_spiffer.cli import main
from auto_spiffer.demo_pdfs import make_demo_invoices
from auto_spiffer.pipeline import (ALREADY, HELD, NOT_ELIGIBLE_ROW, PROBLEM, TO_ENTER, check_program,
                                   prepare)
from auto_spiffer.report import COLUMNS, summary_lines, write_report_csv
from auto_spiffer.report_parse import parse_report
from auto_spiffer.state import State
from auto_spiffer.tirespec import NoiseRules

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
    return NoiseRules(words={"BW", "M", "XL", "RF", "SL", "OWL", "RWL", "WL", "3PMS", "3PMSF", "M+S", "M/S", "MS"},
                      patterns=[re.compile(r"^\d{1,2}PR$", re.IGNORECASE)])


@pytest.fixture(scope="module")
def october():
    class Names:
        claimform_names = BRAND_NAMES
    return parse_claimform(FIXTURES / "ClaimForm.pdf", brands=Names()).catalog


@pytest.fixture(scope="module")
def september_list(october):
    """The October list relabeled as September's, so the program check passes."""
    return replace(october, program="September 2026 Pro Rewards",
                   program_start=date(2026, 9, 1), program_end=date(2026, 9, 30))


@pytest.fixture
def report():
    return parse_report(FIXTURES / "Material-Sales.pdf")


# --------------------------------------------------------------- T21: the program check
def test_program_check_ok_when_the_report_is_inside_the_window(report, september_list):
    check = check_program(report, september_list)
    assert check.ok and check.checked
    assert "inside September 2026 Pro Rewards" in check.message


def test_program_check_fails_for_the_wrong_month(report, october):
    check = check_program(report, october)
    assert not check.ok and check.checked
    assert "09/01/2026 to 09/30/2026" in check.message
    assert "October 2026 Pro Rewards" in check.message and "10/01/2026 to 10/31/2026" in check.message


def test_program_check_cannot_compare_without_dates(report, september_list):
    check = check_program(report, replace(september_list, program_start=None, program_end=None))
    assert check.ok and not check.checked


def test_program_check_uses_sale_dates_when_the_report_has_no_period(report, september_list):
    report.period_start = report.period_end = None
    assert check_program(report, september_list).ok


def test_prepare_stops_on_a_month_mismatch(report, october, brands, noise):
    result = prepare(report, october, brands=brands, noise=noise)
    assert result.blocked and result.claim_rows == []
    assert not result.program_check.ok


def test_prepare_can_ignore_the_mismatch_with_a_warning(report, october, brands, noise):
    result = prepare(report, october, brands=brands, noise=noise, ignore_program_mismatch=True)
    assert not result.blocked and len(result.claim_rows) == 26
    assert any("Program check skipped" in w for w in result.warnings)


# ----------------------------------------------------------- acceptance examples
@pytest.fixture
def prepared(report, september_list, brands, noise):
    return prepare(report, september_list, brands=brands, noise=noise)


def test_ae1_rows_ignored_and_merged(prepared):
    assert len(prepared.report.rows) == 32
    assert len(prepared.ignored) == 3
    assert len(prepared.claim_rows) == 26
    by_invoice = {r.invoice: r for r in prepared.claim_rows}
    for invoice in ("214962", "215024", "215091"):
        assert by_invoice[invoice].qty == 4 and by_invoice[invoice].merged_from == 2


def test_ae2_the_first_example_tire(prepared):
    row = next(r for r in prepared.claim_rows if r.invoice == "214341")
    assert row.status == TO_ENTER
    assert row.product_text == "General Altimax RT45 - Passenger Tires"
    assert (row.qty, row.sale_date_str, row.unit_value) == (4, "09/05/2026", 3.0)
    assert row.item_id == "general-altimax-rt45-passenger"


def test_ae3_ironman_is_not_general(prepared):
    row = next(r for r in prepared.claim_rows if r.invoice == "214745")
    assert row.status == NOT_ELIGIBLE_ROW and row.product_text == ""
    assert any("Ironman" in n for n in row.notes)


def test_status_counts_and_totals(prepared):
    counts = {s: len(prepared.with_status(s)) for s in (TO_ENTER, HELD, NOT_ELIGIBLE_ROW, PROBLEM, ALREADY)}
    assert counts == {TO_ENTER: 17, HELD: 2, NOT_ELIGIBLE_ROW: 7, PROBLEM: 0, ALREADY: 0}
    assert prepared.qty_to_enter == 60
    assert sum(r.qty for r in prepared.claim_rows) == 87
    assert prepared.payout_to_enter == pytest.approx(128.0)


def test_held_rows_carry_their_reason_and_best_guess(prepared):
    row = next(r for r in prepared.claim_rows if r.invoice == "214655")
    assert row.status == HELD and row.product_text == ""
    assert any("HT" in n for n in row.notes) and any("best guess: Nokian One HT" in n for n in row.notes)


# ---------------------------------------------------------------- invoice PDFs
def test_no_invoice_folder_means_no_pdf_check(prepared):
    assert prepared.links is None and len(prepared.to_enter) == 17


def test_missing_pdfs_stop_a_row_from_being_entered(tmp_path, report, september_list, brands, noise):
    make_demo_invoices(report, tmp_path, count=5)
    result = prepare(report, september_list, invoices_folder=tmp_path, brands=brands, noise=noise)
    assert {r.invoice for r in result.to_enter} == {"214288", "214341", "214533"}
    problems = result.with_status(PROBLEM)
    assert len(problems) == 14 and all("no invoice PDF" in " ".join(r.notes) for r in problems)
    assert len(result.links.missing) == 16  # 14 problems + the 2 held rows


def test_allow_missing_pdf(tmp_path, report, september_list, brands, noise):
    make_demo_invoices(report, tmp_path, count=5)
    result = prepare(report, september_list, invoices_folder=tmp_path, brands=brands, noise=noise,
                     allow_missing_pdf=True)
    assert len(result.to_enter) == 17 and result.with_status(PROBLEM) == []


def test_every_pdf_present(tmp_path, report, september_list, brands, noise):
    make_demo_invoices(report, tmp_path, count=100)
    result = prepare(report, september_list, invoices_folder=tmp_path, brands=brands, noise=noise)
    assert len(result.to_enter) == 17 and all(r.pdf_path for r in result.to_enter)
    assert any("09/06/2026" in w for w in result.warnings)  # the planted cross-check warning came through


# ---------------------------------------------------------------------- per-row dates
def test_a_sale_date_outside_the_program_is_a_problem(report, september_list, brands, noise):
    row = next(r for r in report.rows if r.invoice == "214341")
    row.sale_date = date(2026, 10, 5)
    result = prepare(report, september_list, brands=brands, noise=noise)
    flagged = next(r for r in result.claim_rows if r.invoice == "214341")
    assert flagged.status == PROBLEM and "outside the program dates" in " ".join(flagged.notes)


# ------------------------------------------------------------- T23: already entered
def test_already_entered_any_tire(tmp_path, report, september_list, brands, noise):
    state = State(path=tmp_path / "state.json")
    state.mark_entered("214341", "*", 0, "")
    result = prepare(report, september_list, brands=brands, noise=noise, state=state)
    row = next(r for r in result.claim_rows if r.invoice == "214341")
    assert row.status == ALREADY and "already entered" in row.notes[-1]
    assert len(result.to_enter) == 16


def test_already_entered_exact_tire_and_qty(tmp_path, report, september_list, brands, noise):
    state = State(path=tmp_path / "state.json")
    state.mark_entered("214341", "General Altimax RT45 - Passenger Tires", 4, "09/05/2026")
    result = prepare(report, september_list, brands=brands, noise=noise, state=state)
    assert next(r for r in result.claim_rows if r.invoice == "214341").status == ALREADY


def test_a_changed_quantity_is_a_problem_not_a_silent_duplicate(tmp_path, report, september_list, brands, noise):
    state = State(path=tmp_path / "state.json")
    state.mark_entered("214341", "General Altimax RT45 - Passenger Tires", 3, "09/05/2026")
    result = prepare(report, september_list, brands=brands, noise=noise, state=state)
    row = next(r for r in result.claim_rows if r.invoice == "214341")
    assert row.status == PROBLEM and "already entered with qty 3" in " ".join(row.notes)


def test_state_round_trip_and_forget(tmp_path):
    path = tmp_path / "state.json"
    state = State(path=path)
    state.mark_entered("214341", "Tire A", 4, "09/05/2026")
    state.mark_entered("214341", "Tire A", 5, "09/05/2026")  # same key: updated, not duplicated
    state.mark_entered("214533", "Tire B", 4, "09/14/2026")
    state.mark_uploaded("abc123", "214341.pdf", "214341")
    state.mark_uploaded("abc123", "214341.pdf", "214341")
    state.save()

    again = State.load(path)
    assert [(e.invoice, e.qty) for e in again.entered] == [("214341", 5), ("214533", 4)]
    assert again.is_uploaded("abc123") and not again.is_uploaded("zzz")
    assert again.find_entered("214341", "Tire A") and not again.find_entered("214341", "Tire C")
    assert again.forget_invoice("214341") == 2  # one entered, one uploaded
    assert [e.invoice for e in again.entered] == ["214533"] and again.uploaded == []


def test_missing_state_file_is_empty(tmp_path):
    assert State.load(tmp_path / "none.json").entered == []


# ------------------------------------------------------------------- T22: the report
def test_csv_report(tmp_path, prepared):
    path = write_report_csv(prepared, tmp_path, now=datetime(2026, 10, 4, 12, 30, 5))
    assert path.name == "report_20261004-123005.csv"
    with open(path, newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    assert list(rows[0].keys()) == COLUMNS
    assert len(rows) == 26 + 3  # claim lines plus the ignored rows
    first = next(r for r in rows if r["Invoice"] == "214341")
    assert first["Status"] == "ready" and first["Qty"] == "4" and first["Sale Date"] == "09/05/2026"
    assert first["Product"] == "General Altimax RT45 - Passenger Tires"
    assert (first["Unit Value"], first["Est. Payout"]) == ("3.00", "12.00")
    merged = next(r for r in rows if r["Invoice"] == "215091" and r["Status"] == "ready")
    assert merged["Report Rows Merged"] == "2" and merged["Qty"] == "4"
    assert {r["Status"] for r in rows} == {"ready", "needs attention", "not eligible", "ignored"}
    assert sum(r["Status"] == "ignored" for r in rows) == 3


def test_csv_names_never_collide(tmp_path, prepared):
    moment = datetime(2026, 10, 4, 12, 30, 5)
    a = write_report_csv(prepared, tmp_path, now=moment)
    b = write_report_csv(prepared, tmp_path, now=moment)
    assert a != b and a.exists() and b.exists()


def test_summary_lines(prepared):
    text = "\n".join(summary_lines(prepared))
    assert "To enter:             17 rows, qty 60" in text
    assert "Needs attention:       2 rows, qty 8" in text
    assert "Not eligible:          7 rows, qty 19" in text
    assert "Total qty to enter:  60" in text and "Estimated payout:    $128.00" in text
    assert "32 read, 3 ignored" in text


# ---------------------------------------------------------------------------- CLI
REPORT = str(FIXTURES / "Material-Sales.pdf")
CLAIMFORM = str(FIXTURES / "ClaimForm.pdf")


def test_cli_prepare_stops_on_month_mismatch(app_home, capsys):
    assert main(["prepare", REPORT, "--claimform", CLAIMFORM]) == 1
    out = capsys.readouterr().out
    assert "STOPPED:" in out and "October 2026 Pro Rewards" in out
    assert not list(paths.output_dir().glob("*.csv")) if paths.output_dir().exists() else True


def test_cli_prepare_with_override_writes_a_csv(app_home, capsys):
    assert main(["prepare", REPORT, "--claimform", CLAIMFORM, "--ignore-program-mismatch"]) == 0
    out = capsys.readouterr().out
    assert "Program check: SKIPPED" in out
    assert "To enter:             17 rows, qty 60" in out
    assert "Report saved:" in out
    assert len(list(paths.output_dir().glob("report_*.csv"))) == 1


def test_cli_prepare_no_csv(app_home, capsys):
    main(["prepare", REPORT, "--claimform", CLAIMFORM, "--ignore-program-mismatch", "--no-csv"])
    assert "Report saved" not in capsys.readouterr().out


def test_cli_state_mark_show_forget_and_prepare(app_home, capsys):
    assert main(["state-mark", "214341"]) == 0
    capsys.readouterr()
    main(["state-show"])
    assert "214341" in capsys.readouterr().out
    main(["prepare", REPORT, "--claimform", CLAIMFORM, "--ignore-program-mismatch", "--no-csv"])
    out = capsys.readouterr().out
    assert "ALREADY ENTERED" in out and "To enter:             16 rows" in out
    assert main(["state-forget", "214341"]) == 0
    main(["prepare", REPORT, "--claimform", CLAIMFORM, "--ignore-program-mismatch", "--no-csv"])
    assert "To enter:             17 rows" in capsys.readouterr().out


def test_cli_prepare_with_invoices(app_home, tmp_path, capsys):
    folder = str(tmp_path / "inv")
    main(["demo-invoices", REPORT, folder])
    capsys.readouterr()
    main(["prepare", REPORT, "--claimform", CLAIMFORM, "--ignore-program-mismatch", "--no-csv",
          "--invoices", folder])
    out = capsys.readouterr().out
    assert "To enter:              3 rows" in out and "Problems:             14 rows" in out
    assert "Missing invoice PDFs: 16" in out


# --------------------------------------------------- T24: the core never touches the GUI
def test_core_modules_do_not_import_the_gui():
    package = Path(paths.__file__).parent
    offenders = []
    for source in package.rglob("*.py"):
        if "gui" in source.relative_to(package).parts:
            continue  # the window itself may use tkinter
        launcher = source.name == "cli.py"  # the only core file that may start the window, and only by name
        tree = ast.parse(source.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            names = []
            if isinstance(node, ast.Import):
                names = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom):
                names = [node.module or ""] + [f"{node.module}.{a.name}" for a in node.names]
            for name in names:
                toolkit = name.split(".")[0] in ("tkinter", "tkinterdnd2", "windnd")
                window = ".gui" in f".{name}" and not launcher
                if toolkit or window:
                    offenders.append(f"{source.name}: imports {name}")
    assert offenders == []


def test_summary_can_leave_out_quantity_totals(prepared):
    plain = "\n".join(summary_lines(prepared, show_qty=False))
    assert "qty" not in plain and "To enter:             17 rows" in plain
    assert "Estimated payout:    $128.00" in plain
    assert "Total qty to enter:  60" in "\n".join(summary_lines(prepared))  # the default is unchanged
