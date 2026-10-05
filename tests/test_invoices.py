import re
import shutil
from datetime import date
from pathlib import Path

import pytest

from auto_spiffer.brands import BrandTable
from auto_spiffer.catalog_import import parse_claimform
from auto_spiffer.cli import main
from auto_spiffer.demo_pdfs import make_demo_invoices, make_invoice_pdf, make_text_pdf
from auto_spiffer.invoices import (InvoiceError, crosscheck, index_folder, index_paths, link_invoices,
                                   read_invoice, size_core)
from auto_spiffer.report_match import match_report, merge_rows
from auto_spiffer.report_parse import parse_report
from auto_spiffer.tirespec import NoiseRules

FIXTURES = Path(__file__).parent / "fixtures"
BRAND_NAMES = ["Continental", "Falken", "General", "Hercules", "Nitto", "Nokian", "Pirelli", "Toyo"]


# ------------------------------------------------------------- T18: one invoice
def test_real_invoice_number_and_date(fixtures):
    info = read_invoice(fixtures / "example_invoice.pdf")
    assert info.invoice == "192982"
    assert info.invoice_date == date(2024, 9, 6)  # the Invoice Date, not the 10/12/2024 print stamp
    assert info.sizes == ["225/65R17"]
    assert len(info.file_hash) == 64
    assert info.warnings == [] and not info.from_filename


def test_invoice_date_is_not_the_print_stamp(tmp_path):
    pdf = make_invoice_pdf(tmp_path / "a.pdf", "214341", date(2026, 9, 5), "GEN ALTIMAX RT45 235/50R18 97H")
    info = read_invoice(pdf)
    assert info.invoice == "214341" and info.invoice_date == date(2026, 9, 5)


def test_file_name_is_used_when_the_pdf_has_no_number(tmp_path):
    pdf = make_text_pdf(tmp_path / "214341.pdf", ["Some invoice without the label", "235/50R18"])
    info = read_invoice(pdf)
    assert info.invoice == "214341" and info.from_filename
    assert any("file name" in w for w in info.warnings)


def test_no_number_anywhere(tmp_path):
    pdf = make_text_pdf(tmp_path / "scan.pdf", ["nothing useful"])
    info = read_invoice(pdf)
    assert info.invoice is None
    assert any("No invoice number" in w for w in info.warnings)


def test_pdf_number_wins_over_a_wrong_file_name(tmp_path):
    pdf = make_invoice_pdf(tmp_path / "invoice_111111.pdf", "222222", date(2026, 9, 5), "X 235/50R18")
    info = read_invoice(pdf)
    assert info.invoice == "222222"
    assert any("file name says 111111" in w for w in info.warnings)


def test_two_numbers_inside_one_pdf_warns(tmp_path):
    pdf = make_text_pdf(tmp_path / "two.pdf", ["Invoice # 111111", "Invoice # 222222", "Invoice # 222222"])
    info = read_invoice(pdf)
    assert info.invoice == "222222" and info.numbers == ["111111", "222222"]
    assert any("More than one invoice number" in w for w in info.warnings)


def test_unreadable_and_missing_files(tmp_path):
    bad = tmp_path / "fake.pdf"
    bad.write_text("not a pdf")
    with pytest.raises(InvoiceError, match="Could not read"):
        read_invoice(bad)
    with pytest.raises(InvoiceError, match="not found"):
        read_invoice(tmp_path / "nope.pdf")


@pytest.mark.parametrize("a, b", [
    ("235/50R18", "235/50R18"),
    ("LT265/75R16/10", "265/75R16"),
    ("255/35ZR19XL", "255/35R19"),
    ("35X12.5R18LT/12", "35X12.50R18LT"),
])
def test_size_core_ignores_prefix_suffix_and_decimals(a, b):
    assert size_core(a) == size_core(b) is not None


def test_different_sizes_have_different_cores():
    assert size_core("235/50R18") != size_core("225/65R17")
    assert size_core("Shipping") is None


# ---------------------------------------------------------------- T19: a folder
def test_index_a_folder(tmp_path, fixtures):
    shutil.copy(fixtures / "example_invoice.pdf", tmp_path / "example_invoice.pdf")
    shutil.copy(fixtures / "example_invoice.pdf", tmp_path / "random-name.pdf")
    make_invoice_pdf(tmp_path / "b.pdf", "214341", date(2026, 9, 5), "X 235/50R18")
    (tmp_path / "notes.txt").write_text("hello")
    (tmp_path / "sub").mkdir()
    make_invoice_pdf(tmp_path / "sub" / "c.pdf", "214999", date(2026, 9, 5), "X 235/50R18")
    (tmp_path / "broken.pdf").write_text("not a pdf")

    index = index_folder(tmp_path)
    assert sorted(index.by_invoice) == ["192982", "214341"]  # subfolders are not searched
    group = index.by_invoice["192982"]
    assert [p.path.name for p in group] == ["example_invoice.pdf", "random-name.pdf"]
    assert any("identical copies" in w for w in group[1].warnings)
    assert [p.name for p, _ in index.problems] == ["broken.pdf"]
    assert [p.name for p in index.skipped] == ["notes.txt"]
    assert list(index.duplicates) == ["192982"]
    assert index.pdf_for("192982").path.name == "example_invoice.pdf"
    assert index.pdf_for("000000") is None


def test_different_files_for_the_same_invoice_are_flagged(tmp_path):
    make_invoice_pdf(tmp_path / "a.pdf", "214341", date(2026, 9, 5), "X 235/50R18")
    make_invoice_pdf(tmp_path / "b.pdf", "214341", date(2026, 9, 5), "Y 235/50R18 and more")
    index = index_folder(tmp_path)
    assert any("different files" in w for w in index.by_invoice["214341"][1].warnings)


def test_index_missing_folder(tmp_path):
    with pytest.raises(InvoiceError, match="folder was not found"):
        index_folder(tmp_path / "nope")


def test_index_chosen_files(tmp_path):
    a = make_invoice_pdf(tmp_path / "a.pdf", "214341", date(2026, 9, 5), "X 235/50R18")
    index = index_paths([a, tmp_path / "x.jpg"])
    assert list(index.by_invoice) == ["214341"]
    assert [p.name for p in index.skipped] == ["x.jpg"]


# --------------------------------------------------------------- T20: link rows
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
def september(brands, noise):
    class Names:
        claimform_names = BRAND_NAMES
    catalog = parse_claimform(FIXTURES / "ClaimForm.pdf", brands=Names()).catalog
    report = parse_report(FIXTURES / "Material-Sales.pdf")
    return report, catalog


def fresh_rows(september, brands, noise):
    report, catalog = september
    return merge_rows(match_report(report, catalog, brands, noise)), report


def test_demo_invoices_are_readable(tmp_path, september):
    report, _ = september
    notes = make_demo_invoices(report, tmp_path, count=5)
    assert notes[0].startswith("Created 6 PDFs")
    index = index_folder(tmp_path)
    assert sorted(index.by_invoice) == ["214288", "214341", "214354", "214502", "214533", "999999"]


def test_link_finds_missing_unused_and_unneeded(tmp_path, september, brands, noise):
    rows, report = fresh_rows(september, brands, noise)
    make_demo_invoices(report, tmp_path, count=5)
    links = link_invoices(rows, index_folder(tmp_path), {r.invoice for r in report.rows})

    with_pdf = {m.invoice for m in rows if m.pdf}
    assert with_pdf == {"214288", "214341", "214354", "214502", "214533"}
    assert len(links.missing) == 16  # 19 sales to claim, 3 of them have a PDF
    assert "214288" not in links.missing and "214629" in links.missing
    assert "214354" not in links.missing  # not eligible, so its PDF is not required
    assert [p.invoice for p in links.unused] == ["999999"]
    assert [p.invoice for p in links.unneeded] == ["214354", "214502"]


def test_crosscheck_warnings(tmp_path, september, brands, noise):
    rows, report = fresh_rows(september, brands, noise)
    make_demo_invoices(report, tmp_path, count=5)
    links = link_invoices(rows, index_folder(tmp_path))
    assert any("214341" in w and "09/05/2026" in w and "09/06/2026" in w for w in links.warnings)
    assert any("214354" in w and "205/55R16" in w for w in links.warnings)
    assert not any("214288" in w or "214533" in w for w in links.warnings)  # the correct ones are quiet


def test_crosscheck_is_quiet_when_everything_agrees(tmp_path, september, brands, noise):
    rows, report = fresh_rows(september, brands, noise)
    row = next(m for m in rows if m.invoice == "214341")
    pdf = read_invoice(make_invoice_pdf(tmp_path / "x.pdf", "214341", date(2026, 9, 5), row.description))
    assert crosscheck(row, pdf) == []


def test_every_sale_with_a_pdf_when_all_are_present(tmp_path, september, brands, noise):
    rows, report = fresh_rows(september, brands, noise)
    make_demo_invoices(report, tmp_path, count=100)
    links = link_invoices(rows, index_folder(tmp_path), {r.invoice for r in report.rows})
    assert links.missing == []
    assert all(m.pdf for m in rows)


def test_duplicate_pdfs_do_not_break_linking(tmp_path, september, brands, noise):
    rows, report = fresh_rows(september, brands, noise)
    make_demo_invoices(report, tmp_path, count=1)
    shutil.copy(tmp_path / "invoice_214288.pdf", tmp_path / "copy.pdf")
    link_invoices(rows, index_folder(tmp_path))
    assert next(m for m in rows if m.invoice == "214288").pdf.path.name == "copy.pdf"  # first by name


# ------------------------------------------------------------------------- CLI
def test_cli_read_invoice(fixtures, capsys):
    assert main(["read-invoice", str(fixtures / "example_invoice.pdf")]) == 0
    out = capsys.readouterr().out
    assert "Invoice #:     192982" in out and "Invoice date:  09/06/2024" in out


def test_cli_read_invoice_error(tmp_path, capsys):
    assert main(["read-invoice", str(tmp_path / "missing.pdf")]) == 1
    assert "Error:" in capsys.readouterr().out


def test_cli_index_invoices(tmp_path, fixtures, capsys):
    shutil.copy(fixtures / "example_invoice.pdf", tmp_path / "example_invoice.pdf")
    shutil.copy(fixtures / "example_invoice.pdf", tmp_path / "random-name.pdf")
    assert main(["index-invoices", str(tmp_path)]) == 0
    out = capsys.readouterr().out
    assert "192982" in out and "identical copies" in out
    assert "Invoice numbers:     1" in out and "Invoices with extra copies: 1" in out


def test_cli_demo_and_match_report_with_invoices(tmp_path, app_home, capsys):
    folder = str(tmp_path / "inv")
    report = str(FIXTURES / "Material-Sales.pdf")
    claimform = str(FIXTURES / "ClaimForm.pdf")
    assert main(["demo-invoices", report, folder]) == 0
    capsys.readouterr()
    assert main(["match-report", report, "--claimform", claimform, "--invoices", folder]) == 0
    out = capsys.readouterr().out
    assert "Missing invoice PDFs: 16" in out
    assert "Unused PDFs:          1" in out and "invoice_999999.pdf" in out
    assert "Not needed PDFs:      2" in out
    assert "Cross-check: 214341" in out
    assert "NO PDF" in out and " yes " in out


def test_cli_match_report_bad_invoice_folder(tmp_path, app_home, capsys):
    assert main(["match-report", str(FIXTURES / "Material-Sales.pdf"), "--claimform",
                 str(FIXTURES / "ClaimForm.pdf"), "--invoices", str(tmp_path / "nope")]) == 1
    assert "folder was not found" in capsys.readouterr().out
