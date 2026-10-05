"""T40: the acceptance examples from the plan (AE1 to AE7), each as one readable test.

They use the real September report, the real October ClaimForm, and the saved claim page.
AE7 drives a real (hidden) browser, so it is skipped if no browser is installed.
"""
import re
from dataclasses import replace
from datetime import date
from pathlib import Path

import pytest

from auto_spiffer.brands import BrandTable
from auto_spiffer.browser import BrowserSession
from auto_spiffer.catalog_import import parse_claimform
from auto_spiffer.demo_pdfs import make_demo_invoices
from auto_spiffer.fill import Filler, FillError, check_page, load_config
from auto_spiffer.match import ATTENTION, NOT_ELIGIBLE, READY, match_tire
from auto_spiffer.pipeline import prepare
from auto_spiffer.product_map import ProductMap
from auto_spiffer.report_parse import parse_report
from auto_spiffer.state import State
from auto_spiffer.tirespec import NoiseRules, parse_tire

FIXTURES = Path(__file__).parent / "fixtures"
NAMES = ["Continental", "Falken", "General", "Hercules", "Nitto", "Nokian", "Pirelli", "Toyo"]


@pytest.fixture(scope="module")
def brands():
    return BrandTable(
        claimform={"CON": "Continental", "FAL": "Falken", "GEN": "General", "HER": "Hercules",
                   "NIT": "Nitto", "NOK": "Nokian", "TOY": "Toyo", "PIRELLI": "Pirelli"},
        other={"CAR": "Carlisle", "FST": "FST", "IRON": "Ironman"})


@pytest.fixture(scope="module")
def noise():
    return NoiseRules(words={"BW", "M", "XL", "RF", "SL", "OWL", "RWL", "WL", "3PMS", "3PMSF", "M+S", "M/S", "MS"},
                      patterns=[re.compile(r"^\d{1,2}PR$", re.IGNORECASE)])


@pytest.fixture(scope="module")
def october():
    class Names:
        claimform_names = NAMES
    return parse_claimform(FIXTURES / "ClaimForm.pdf", brands=Names()).catalog


@pytest.fixture(scope="module")
def september_list(october):
    """The October list standing in for the September one, so the program check lines up."""
    return replace(october, program="September 2026 Pro Rewards",
                   program_start=date(2026, 9, 1), program_end=date(2026, 9, 30))


@pytest.fixture
def report():
    return parse_report(FIXTURES / "Material-Sales.pdf")


def test_ae1_the_report_is_read_cleaned_and_merged(report, september_list, brands, noise):
    """32 raw rows, 3 ignored (2 shipping, 1 tube), and 214962, 215024, 215091 each become one row."""
    assert len(report.rows) == 32
    assert sorted(r.ignored_reason for r in report.ignored_rows) == ["shipping/handling", "shipping/handling", "tube"]
    result = prepare(report, september_list, brands=brands, noise=noise)
    assert len(result.claim_rows) == 26
    merged = {r.invoice: r for r in result.claim_rows if r.merged_from == 2}
    assert set(merged) == {"214962", "215024", "215091"}
    assert all(r.qty == 4 for r in merged.values())


def test_ae2_the_first_example_tire_is_matched(october, brands, noise):
    spec = parse_tire("235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)", brands, noise)
    result = match_tire(spec, october)
    assert result.status == READY and result.item.site_text == "General Altimax RT45 - Passenger Tires"


def test_ae3_the_ironman_tire_is_not_general(october, brands, noise):
    spec = parse_tire("205/40ZR17XL 84W IRON iMOVE GEN 3 AS 40K 205/40ZR17XL BW 84W (40K)", brands, noise)
    assert match_tire(spec, october).status == NOT_ELIGIBLE


def test_ae4_unsure_tires_are_held_and_remembered(october, brands, noise, tmp_path):
    held = {}
    for text in ("245/55R19 103H NOK ONE BW 80K 245/55R19 103H (80K)",
                 "275/55R20XL 117T HER TERRA TRAC AT X-JOURNEY 3PMS 60K"):
        spec = parse_tire(text, brands, noise)
        result = match_tire(spec, october)
        assert result.status == ATTENTION and result.candidates
        held[text] = (spec, result.candidates[0][0])
    saved = ProductMap(path=tmp_path / "product_map.json")
    for spec, item in held.values():
        saved.remember(spec, item.id)
    saved.save()
    again = ProductMap.load(tmp_path / "product_map.json")
    for text, (_spec, item) in held.items():
        result = match_tire(parse_tire(text, brands, noise), october, again)
        assert (result.status, result.tier, result.item.id) == (READY, "saved", item.id)


def test_ae5_the_october_claimform_imports_77_items(october):
    assert (len(october.items), len(october.tires), len(october.wheels)) == (77, 75, 2)
    assert (october.program_start, october.program_end) == (date(2026, 10, 1), date(2026, 10, 31))


def test_ae6_the_wrong_month_stops_before_any_website(report, october, brands, noise):
    result = prepare(report, october, brands=brands, noise=noise)
    assert result.blocked and result.claim_rows == []
    assert "09/01/2026 to 09/30/2026" in result.program_check.message
    assert "October 2026 Pro Rewards" in result.program_check.message


def test_ae7_a_full_entry_submits_nothing_and_a_second_run_adds_nothing(
        report, october, brands, noise, tmp_path):
    """Every ready sale is entered with its PDF, the page is never submitted, and running again adds nothing."""
    invoices = tmp_path / "inv"
    make_demo_invoices(report, invoices, count=100)
    state_path = tmp_path / "state.json"
    # The saved page is October's, so the month mismatch with the September report is overridden here.
    first = prepare(report, october, invoices_folder=invoices, brands=brands, noise=noise,
                    state=State(path=state_path), ignore_program_mismatch=True)
    rows = first.to_enter
    assert len(rows) == 17

    dates = [r.sale_date for r in rows]
    window = (min(dates).strftime("%m/%d/%Y"), max(dates).strftime("%m/%d/%Y"))
    session = BrowserSession(load_config(Path(__file__).parent.parent / "auto_spiffer" / "defaults" / "config.toml"),
                             test_mode=True, headless=True, test_window=window)
    try:
        session.start()
    except FillError as exc:
        pytest.skip(f"no browser available: {exc}")
    try:
        def entry(sess):
            claim = sess.claim_page()
            assert check_page(claim.read_info(), rows, october).ok
            return Filler(claim, State.load(state_path), snapshot_dir=tmp_path).run(rows)

        summary = session.call(entry)
        assert (len(summary.entered), len(summary.failed), len(summary.uploaded)) == (17, 0, 17)
        stub = session.call(lambda s: s.page.evaluate(
            "() => [window.__stub.nextClicked, window.__stub.clicks, window.__stub.rows.length]"))
        assert stub[0] is False and "DefaultContent_GoToStepFourLinkButton" not in stub[1]
        assert stub[2] == 17  # everything that was ready, on the page, and nothing else

        # running again: the record on disk marks every line as entered, so nothing is left to do
        second = prepare(report, october, invoices_folder=invoices, brands=brands, noise=noise,
                         state=State.load(state_path), ignore_program_mismatch=True)
        assert second.to_enter == [] and len(second.with_status("already_entered")) == 17

        # and even if the same lines were forced through, the page's own list stops a double entry
        again = session.call(lambda s: Filler(s.claim_page(), State.load(state_path),
                                              snapshot_dir=tmp_path).run(rows))
        assert (len(again.entered), len(again.already_there), len(again.uploaded)) == (0, 17, 0)
        assert session.call(lambda s: s.page.evaluate("() => window.__stub.rows.length")) == 17
    finally:
        session.close()
