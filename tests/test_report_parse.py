from datetime import date

import pytest

from auto_spiffer.cli import main
from auto_spiffer.models import format_page_date
from auto_spiffer.report_parse import (ReportError, classify_row, clean_description,
                                       parse_report, parse_report_date)
from auto_spiffer.sizes import find_sizes, has_tire_size


@pytest.fixture(scope="module")
def report():
    from pathlib import Path
    return parse_report(Path(__file__).parent / "fixtures" / "Material-Sales.pdf")


# ---------------------------------------------------------------- T3: raw rows
def test_header_period_and_location(report):
    assert report.period_start == date(2026, 9, 1)
    assert report.period_end == date(2026, 9, 30)
    assert "Stillwater" in report.location


def test_reads_all_rows_from_both_pages(report):
    assert len(report.rows) == 32
    first, last = report.rows[0], report.rows[-1]
    assert (first.sale_date, first.invoice, first.qty) == (date(2026, 9, 1), "214195", 1)
    assert (last.sale_date, last.invoice, last.qty) == (date(2026, 9, 30), "215100", 4)


def test_wrapped_description_is_one_line(report):
    row = next(r for r in report.rows if r.invoice == "214341")
    assert row.description == "235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)"


def test_page_two_rows_are_included(report):
    assert {"215024", "215081", "215091", "215100"} <= {r.invoice for r in report.rows}


def test_no_warnings_on_real_report(report):
    assert report.warnings == []


def test_fallback_reader_gives_same_rows_as_tables(fixtures):
    by_table = parse_report(fixtures / "Material-Sales.pdf")
    by_words = parse_report(fixtures / "Material-Sales.pdf", use_fallback=True)
    key = lambda r: (r.sale_date, r.invoice, r.description, r.qty, r.ignored_reason)
    assert [key(r) for r in by_words.rows] == [key(r) for r in by_table.rows]
    assert by_words.warnings == []


# ---------------------------------------------------------- T4: non-tire rows
def test_three_rows_ignored_with_reasons(report):
    ignored = report.ignored_rows
    assert len(ignored) == 3
    assert [(r.invoice, r.ignored_reason) for r in ignored] == [
        ("214195", "tube"),
        ("214962", "shipping/handling"),
        ("214962", "shipping/handling"),
    ]
    assert len(report.tire_rows) == 29


@pytest.mark.parametrize("description, reason", [
    ("Shipping and Handling", "shipping/handling"),
    ("18X8.50/9.50-8 FST IMPORT TR13 TUBE 18X850/950-8", "tube"),
    ("Mount and balance", "no tire size"),
    ("235/50R18 97H GEN AltiMAX RT45 65K", None),
])
def test_classify_row(description, reason):
    assert classify_row(description) == reason


# ---------------------------------------------- T5: dates, quantities, totals
def test_dates_are_real_dates_and_page_format(report):
    row = next(r for r in report.rows if r.invoice == "214341")
    assert row.sale_date == date(2026, 9, 5)
    assert format_page_date(row.sale_date) == "09/05/2026"


def test_parse_report_date_accepts_unpadded():
    assert parse_report_date("9/5/2026") == date(2026, 9, 5)
    assert parse_report_date("09/05/2026") == date(2026, 9, 5)


def test_quantities_are_integers_and_total(report):
    assert all(isinstance(r.qty, int) for r in report.rows)
    assert report.total_tire_qty == 87


def test_clean_description_joins_lines():
    assert clean_description("a  b\nc ") == "a b c"


# ------------------------------------------------------------------- sizes
@pytest.mark.parametrize("text, expected", [
    ("235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)", ["235/50R18", "235/50R18"]),
    ("255/35ZR19XL 96Y CON", ["255/35ZR19XL"]),
    ("LT265/75R16/10 123/120S NOK OUTPOST NAT", ["LT265/75R16/10"]),
    ("HER STRONG GUARD ST ST205/75R14/8 105/101N", ["ST205/75R14/8"]),
    ("35X12.5R18LT/12 128R NIT TERRA GRAPPLER G3 BW 55K 35X12.50R18LT/12 BW", ["35X12.5R18LT/12", "35X12.50R18LT/12"]),
    ("LT37X12.50R20/10 126Q TOY", ["LT37X12.50R20/10"]),
    ("NIT TERRA GRAPPLER G3 275/60R20XL 116T", ["275/60R20XL"]),
])
def test_find_sizes(text, expected):
    assert find_sizes(text) == expected


def test_load_speed_and_words_are_not_sizes():
    assert not has_tire_size("123/120S NOK ONE BW 80K")
    assert not has_tire_size("Shipping and Handling")


# ------------------------------------------------------------------ errors
def test_missing_file_gives_plain_error(tmp_path):
    with pytest.raises(ReportError, match="not found"):
        parse_report(tmp_path / "nope.pdf")


def test_not_a_pdf_gives_plain_error(tmp_path):
    bad = tmp_path / "fake.pdf"
    bad.write_text("this is not a pdf")
    with pytest.raises(ReportError, match="Could not read"):
        parse_report(bad)


def test_wrong_pdf_gives_plain_error(fixtures):
    with pytest.raises(ReportError, match="Material Sales"):
        parse_report(fixtures / "example_invoice.pdf")


# --------------------------------------------------------------------- CLI
def test_read_report_command(fixtures, capsys):
    assert main(["read-report", str(fixtures / "Material-Sales.pdf")]) == 0
    out = capsys.readouterr().out
    assert "Rows read:       32" in out
    assert "Tire rows:       29" in out
    assert "Ignored rows:    3" in out
    assert "Total tire qty:  87" in out
    assert "09/01/2026 to 09/30/2026" in out


def test_read_report_command_reports_error(tmp_path, capsys):
    assert main(["read-report", str(tmp_path / "missing.pdf")]) == 1
    assert "Error:" in capsys.readouterr().out
