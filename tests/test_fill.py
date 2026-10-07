"""The browser step, tested for real: Chrome (or Edge) opens the saved copy of the claim page, the
test stub plays the server, and every web request is blocked. Skipped if no browser is installed."""
import threading
from dataclasses import replace
from datetime import date
from pathlib import Path

import pytest

from auto_spiffer import paths
from auto_spiffer.browser import BrowserSession, launch_chromium, saved_page_path
from auto_spiffer.catalog_import import parse_claimform
from auto_spiffer.cli import main
from auto_spiffer.demo_pdfs import make_invoice_pdf
from auto_spiffer.fill import (ClaimPage, FillConfig, FillError, Filler, GridRow, PageInfo, RunControl,
                               RunSummary, check_page, file_hash, load_config)
from auto_spiffer.models import ClaimRow
from auto_spiffer.page_stub import install_stub
from auto_spiffer.state import State

FIXTURES = Path(__file__).parent / "fixtures"
ALTIMAX = "General Altimax RT45 - Passenger Tires"
STRONG = "Hercules Strong Guard ST Trailer - BOAT TRAILER TIRES"
NOKIAN = "Nokian Outpost nAT - Light Truck Tires"
TOYO = "Toyo Open Country A/T III - Light Truck Tires"
SEPT_WINDOW = ("09/01/2026", "09/30/2026")


# ------------------------------------------------------------------ fixtures
@pytest.fixture(scope="module")
def browser():
    cfg = load_config(paths.defaults_dir() / "config.toml")
    session = BrowserSession(cfg, test_mode=True, headless=True, test_window=SEPT_WINDOW)
    try:
        session.start()
    except FillError as exc:
        pytest.skip(f"no browser available: {exc}")
    yield session
    session.close()


def fresh(browser, window=SEPT_WINDOW):
    """Reload the saved page so every test starts from an empty list."""
    def job(sess):
        sess.page.reload(wait_until="load")
        sess.page.wait_for_timeout(250)
        install_stub(sess.page, window)
    browser.call(job)


@pytest.fixture
def page(browser):
    fresh(browser)
    return browser


def on_page(browser, fn):
    return browser.call(lambda sess: fn(sess.claim_page(), sess))


def row(invoice="214341", tire=ALTIMAX, qty=4, day=date(2026, 9, 5), pdf=None):
    return ClaimRow(sale_date=day, invoice=invoice, product_text=tire, qty=qty,
                    pdf_path=str(pdf) if pdf else None)


def make_pdfs(tmp_path, *invoices):
    out = {}
    for inv in invoices:
        out[inv] = make_invoice_pdf(tmp_path / f"invoice_{inv}.pdf", inv, date(2026, 9, 5), "X 235/50R18")
    return out


def stub(sess, expression):
    return sess.page.evaluate(f"() => {expression}")


# ---------------------------------------------------------------- T31: the page
def test_every_field_is_found(page):
    info = on_page(page, lambda claim, _s: claim.read_info())
    cfg = load_config(paths.defaults_dir() / "config.toml")
    for key in ("date", "invoice", "product_select", "product_chosen", "qty", "add", "grid",
                "upload_input", "duplicate_popup", "validation_popup", "next_button"):
        assert info.counts[key] >= 1, key
    assert set(cfg.selectors) == set(info.counts)


def test_page_facts(page):
    info = on_page(page, lambda claim, _s: claim.read_info())
    assert "October 2026 Pro Rewards" in info.promotion
    assert info.window == (date(2026, 9, 1), date(2026, 9, 30))  # the test stub's window
    assert info.rows == []
    assert len(info.options) == 77


def test_the_real_pages_own_date_window_is_read_when_no_stub_window(browser):
    fresh(browser, window=None)
    info = on_page(browser, lambda claim, _s: claim.read_info())
    assert info.window == (date(2026, 10, 1), date(2026, 10, 31))
    fresh(browser)


def test_the_dropdown_is_word_for_word_the_claimform(page):
    options = on_page(page, lambda claim, _s: claim.options())
    catalog = parse_claimform(FIXTURES / "ClaimForm.pdf").catalog
    assert sorted(options) == sorted(i.site_text for i in catalog.items)


def test_test_mode_blocks_the_real_website(page):
    blocked = page.call(lambda s: s.page.evaluate(
        "() => fetch('https://prorewards.acbrewards.com/').then(() => 'reached', () => 'blocked')"))
    assert blocked == "blocked"


def test_a_page_that_is_not_the_claim_form_is_not_recognized(browser):
    def job(sess):
        other = sess.context.new_page()
        other.set_content("<html><body>Login page</body></html>")
        try:
            return ClaimPage(other, sess.cfg).is_claim_page()
        finally:
            other.close()
    assert browser.call(job) is False


def test_find_picks_the_tab_with_the_claim_form(browser):
    fresh(browser)

    def job(sess):
        other = sess.context.new_page()
        other.set_content("<html><body>Something else</body></html>")
        try:
            claim = ClaimPage.find(sess.context, sess.cfg)
            return claim is not None and claim.page == sess.page
        finally:
            other.close()
    assert browser.call(job) is True


# ----------------------------------------------------------- T33: entering a row
def test_add_one_row(page):
    def job(claim, _s):
        result = claim.add_row(row())
        return result, claim.grid_rows(), claim.loc("invoice").first.input_value()
    result, rows, leftover = on_page(page, job)
    assert result.ok and result.outcome == "added"
    assert rows == [GridRow(date(2026, 9, 5), "214341", ALTIMAX, 4)]
    assert leftover == ""  # the page cleared its boxes, like the real one


def test_the_product_is_chosen_by_exact_name(page):
    def job(claim, _s):
        claim.select_product(TOYO)
        first = claim._selected_product()
        claim.select_product("Toyo Open Country A/T III - Light Truck Tires")  # same, picked again
        return first
    assert on_page(page, job) == TOYO


def test_a_tire_that_is_not_on_the_list_is_refused(page):
    def job(claim, _s):
        with pytest.raises(FillError, match="not in the website's product list"):
            claim.select_product("General Altimax RT45 - Passenger Tire")
        return claim.grid_rows()
    assert on_page(page, job) == []


def test_a_date_outside_the_programs_dates_is_rejected_by_the_page(page):
    def job(claim, _s):
        result = claim.add_row(row(day=date(2026, 10, 5)))
        dismissed_before = claim._visible("validation_popup")
        claim.dismiss_validation()
        return result, dismissed_before, claim._visible("validation_popup"), claim.grid_rows()
    result, shown, still, rows = on_page(page, job)
    assert result.outcome == "rejected" and "outside the promotion dates" in result.message
    assert shown and not still and rows == []


def test_entering_the_same_line_twice_asks_about_a_duplicate(page):
    def job(claim, _s):
        first = claim.add_row(row())
        second = claim.add_row(row())
        popup = claim._visible("duplicate_popup")
        claim.cancel_duplicate()
        return first, second, popup, claim._visible("duplicate_popup"), claim.grid_rows()
    first, second, popup, after, rows = on_page(page, job)
    assert first.ok and second.outcome == "duplicate"
    assert popup and not after
    assert len(rows) == 1  # 'No' was answered, never 'Yes'


def test_two_different_tires_on_one_invoice(page):
    def job(claim, _s):
        return claim.add_row(row(tire=ALTIMAX)).ok, claim.add_row(row(tire=NOKIAN, qty=2)).ok, claim.grid_rows()
    a, b, rows = on_page(page, job)
    assert a and b and [(r.product, r.qty) for r in rows] == [(ALTIMAX, 4), (NOKIAN, 2)]


# --------------------------------------------------------------- never submit
def test_the_never_click_list_is_enforced(page):
    def job(claim, sess):
        for key in ("next_button",):
            with pytest.raises(FillError, match="never submits"):
                claim._click(key)
        listed = replace(sess.cfg, never_click=set(sess.cfg.never_click) | {claim.sel("add")})
        with pytest.raises(FillError, match="never submits"):
            ClaimPage(claim.page, listed)._click("add")
        return stub(sess, "window.__stub.nextClicked")
    assert on_page(page, job) is False


def test_yes_to_a_duplicate_is_on_the_never_click_list():
    cfg = load_config(paths.defaults_dir() / "config.toml")
    assert "#DefaultContent_YesLinkButton" in cfg.never_click
    assert "#DefaultContent_GoToStepFourLinkButton" in cfg.never_click


# ------------------------------------------------------------------- T35: uploads
def test_upload_one_pdf(page, tmp_path):
    pdfs = make_pdfs(tmp_path, "214341", "214533")

    def job(claim, sess):
        claim.upload(pdfs["214341"])
        claim.upload(pdfs["214533"])
        return stub(sess, "window.__stub.files"), claim.loc("uploaded_panel").first.is_visible()
    files, visible = on_page(page, job)
    assert files == ["invoice_214341.pdf", "invoice_214533.pdf"] and visible


def test_upload_that_never_finishes_is_reported(page, tmp_path):
    pdfs = make_pdfs(tmp_path, "214341")

    def job(claim, sess):
        quick = replace(sess.cfg, timeouts={**sess.cfg.timeouts, "upload": 1.0},
                        upload_done=["#never-appears"])
        with pytest.raises(FillError, match="did not finish uploading"):
            ClaimPage(claim.page, quick).upload(pdfs["214341"])
    on_page(page, job)


# ------------------------------------------------------------- T34: the whole run
def run_filler(page, rows, tmp_path, control=None, emit=None, state=None):
    state = state or State(path=tmp_path / "state.json")
    events = []

    def job(claim, _s):
        filler = Filler(claim, state, control, lambda e: (events.append(e), emit and emit(e)),
                        snapshot_dir=tmp_path / "shots")
        return filler.run(rows)
    return on_page(page, job), state, events


def four_rows(tmp_path):
    pdfs = make_pdfs(tmp_path, "214288", "214341", "214533", "214629")
    return [row("214288", STRONG, 1, date(2026, 9, 4), pdfs["214288"]),
            row("214341", ALTIMAX, 4, date(2026, 9, 5), pdfs["214341"]),
            row("214533", NOKIAN, 4, date(2026, 9, 14), pdfs["214533"]),
            row("214629", TOYO, 4, date(2026, 9, 16), pdfs["214629"])]


def test_run_enters_every_line_and_uploads_every_pdf(page, tmp_path):
    rows = four_rows(tmp_path)
    summary, state, events = run_filler(page, rows, tmp_path)
    assert (len(summary.entered), len(summary.failed), len(summary.uploaded)) == (4, 0, 4)
    assert summary.total_qty_entered == 13 and not summary.stopped
    assert [e["done"] for e in events if e["type"] == "progress"] == [0, 1, 2, 3, 4]
    assert events[-1]["type"] == "finished"
    assert [(e.invoice, e.qty) for e in State.load(state.path).entered] == [
        ("214288", 1), ("214341", 4), ("214533", 4), ("214629", 4)]
    assert len(State.load(state.path).uploaded) == 4
    grid = on_page(page, lambda claim, _s: claim.grid_rows())
    assert [g.invoice for g in grid] == ["214288", "214341", "214533", "214629"]
    clicked = page.call(lambda s: stub(s, "[window.__stub.nextClicked, window.__stub.clicks]"))
    assert clicked[0] is False and "DefaultContent_GoToStepFourLinkButton" not in clicked[1]


def test_running_again_adds_nothing(page, tmp_path):
    rows = four_rows(tmp_path)
    run_filler(page, rows, tmp_path)
    remembered = State.load(tmp_path / "state.json")  # what the next run would read from disk
    again, _state, events = run_filler(page, rows, tmp_path, state=remembered)
    assert (len(again.entered), len(again.already_there), len(again.uploaded)) == (0, 4, 0)
    assert len(on_page(page, lambda claim, _s: claim.grid_rows())) == 4
    assert page.call(lambda s: stub(s, "window.__stub.files.length")) == 4  # no PDF twice


def test_a_different_quantity_on_the_page_is_never_overwritten(page, tmp_path):
    rows = four_rows(tmp_path)
    on_page(page, lambda claim, _s: claim.add_row(replace(rows[1], qty=3)))
    summary, _state, _events = run_filler(page, rows, tmp_path)
    assert [(r.invoice, why) for r, why in summary.failed] == [
        ("214341", "the page already has this line with quantity 3, the report says 4")]
    assert len(summary.entered) == 3
    assert [u[0] for u in summary.uploaded] == ["214288", "214533", "214629"]  # nothing entered, so no PDF


def test_a_failing_line_is_retried_once(page, tmp_path, monkeypatch):
    rows = four_rows(tmp_path)[:2]
    calls = {"n": 0}
    original = ClaimPage.add_row

    def flaky(self, r):
        calls["n"] += 1
        if calls["n"] == 1:
            raise FillError("the date box showed something else")
        return original(self, r)
    monkeypatch.setattr(ClaimPage, "add_row", flaky)
    summary, _state, events = run_filler(page, rows, tmp_path)
    assert len(summary.entered) == 2 and summary.failed == []
    assert any("retrying once" in e.get("message", "") for e in events)


def test_a_line_that_fails_twice_is_reported_and_the_run_goes_on(page, tmp_path):
    rows = four_rows(tmp_path)
    rows[1] = replace(rows[1], product_text="General Altimax RT45 - Passenger Tire")  # not on the list
    summary, _state, events = run_filler(page, rows, tmp_path)
    assert len(summary.entered) == 3
    assert [r.invoice for r, _w in summary.failed] == ["214341"]
    assert "not in the website's product list" in summary.failed[0][1]
    assert [u[0] for u in summary.uploaded] == ["214288", "214533", "214629"]
    assert list((tmp_path / "shots").glob("failure_214341_*.png"))  # a picture was kept
    assert any("FAILED" in e.get("message", "") for e in events)


def test_a_rejected_date_is_reported(page, tmp_path):
    rows = four_rows(tmp_path)[:1]
    rows[0] = replace(rows[0], sale_date=date(2026, 10, 5))
    summary, _state, _events = run_filler(page, rows, tmp_path)
    assert len(summary.failed) == 1 and "outside the promotion dates" in summary.failed[0][1]
    assert summary.uploaded == []


def test_a_failed_upload_does_not_stop_the_run(page, tmp_path):
    rows = four_rows(tmp_path)
    rows[1] = replace(rows[1], pdf_path=str(tmp_path / "missing.pdf"))
    summary, _state, _events = run_filler(page, rows, tmp_path)
    assert len(summary.entered) == 4 and len(summary.uploaded) == 3
    assert [u[0] for u in summary.upload_failed] == ["214341"]


def test_a_pdf_that_was_uploaded_before_is_not_uploaded_again(page, tmp_path):
    rows = four_rows(tmp_path)
    state = State(path=tmp_path / "state.json")
    state.mark_uploaded(file_hash(rows[0].pdf_path), "invoice_214288.pdf", "214288")
    summary, _state, events = run_filler(page, rows, tmp_path, state=state)
    assert [u[0] for u in summary.uploaded] == ["214341", "214533", "214629"]
    assert any("already uploaded earlier" in e.get("message", "") for e in events)


def test_a_line_with_no_pdf_is_entered_without_an_upload(page, tmp_path):
    rows = [row("214341", ALTIMAX, 4, date(2026, 9, 5), None)]
    summary, _state, events = run_filler(page, rows, tmp_path)
    assert len(summary.entered) == 1 and summary.uploaded == []
    assert any("only the sales are entered" in e.get("message", "") for e in events)


def test_two_tires_on_one_invoice_upload_one_pdf(page, tmp_path):
    pdf = make_pdfs(tmp_path, "214341")["214341"]
    rows = [row("214341", ALTIMAX, 4, pdf=pdf), row("214341", NOKIAN, 2, pdf=pdf)]
    summary, _state, _events = run_filler(page, rows, tmp_path)
    assert len(summary.entered) == 2 and len(summary.uploaded) == 1


# ------------------------------------------------------------- pause and stop
def test_stop_before_starting_enters_nothing(page, tmp_path):
    control = RunControl()
    control.stop()
    summary, _state, _events = run_filler(page, four_rows(tmp_path), tmp_path, control=control)
    assert summary.stopped and summary.entered == []


def test_stop_finishes_the_current_line_then_ends(page, tmp_path):
    control = RunControl()

    def emit(event):
        if event["type"] == "progress" and event["done"] == 1:
            control.stop()
    summary, _state, _events = run_filler(page, four_rows(tmp_path), tmp_path, control=control, emit=emit)
    assert summary.stopped and len(summary.entered) == 1
    assert [u[0] for u in summary.uploaded] == ["214288"]  # what was entered still gets its PDF
    assert len(on_page(page, lambda claim, _s: claim.grid_rows())) == 1


def test_pause_waits_and_resume_continues(page, tmp_path):
    control = RunControl()
    paused_at = []

    def emit(event):
        if event["type"] == "progress" and event["done"] == 1:
            control.pause()
            paused_at.append(True)
            threading.Timer(0.8, control.resume).start()
    summary, _state, _events = run_filler(page, four_rows(tmp_path), tmp_path, control=control, emit=emit)
    assert paused_at and len(summary.entered) == 4 and not summary.stopped


def test_run_control_flags():
    c = RunControl()
    assert not c.paused and not c.stopped
    c.pause()
    assert c.paused
    c.stop()
    assert c.stopped and not c.paused  # stopping also wakes a paused run
    c.checkpoint()  # returns at once


# ----------------------------------------------------------------- the summary
def test_summary_applies_outcomes_to_rows(tmp_path):
    a, b, c = row("1"), row("2", NOKIAN), row("3", TOYO)
    summary = RunSummary(entered=[a], already_there=[b], failed=[(c, "boom")])
    out = summary.apply_to([a, b, c, row("4", STRONG)])
    assert [r.status for r in out] == ["entered", "entered", "failed", "ready"]
    assert "failed: boom" in out[2].notes
    assert a.status == "ready"  # the originals are untouched
    assert any("Entered:           1 lines" in line for line in summary.lines())


# ------------------------------------------------------------------ page check
def info(**kw):
    base = dict(promotion="October 2026 Pro Rewards (10/1/2026 - 10/31/2026)",
                window=(date(2026, 10, 1), date(2026, 10, 31)), options=[ALTIMAX, NOKIAN], rows=[], counts={})
    base.update(kw)
    return PageInfo(**base)


@pytest.fixture(scope="module")
def october():
    class Names:
        claimform_names = ["Continental", "Falken", "General", "Hercules", "Nitto", "Nokian", "Pirelli", "Toyo"]
    return parse_claimform(FIXTURES / "ClaimForm.pdf", brands=Names()).catalog


def test_check_page_ok(october):
    check = check_page(info(), [row(day=date(2026, 10, 5))], october)
    assert check.ok and check.problems == [] and check.warnings == []


def test_check_page_wrong_program(october):
    check = check_page(info(promotion="September 2026 Pro Rewards (9/1/2026 - 9/30/2026)"),
                       [row(day=date(2026, 10, 5))], october)
    assert not check.ok and "September 2026 Pro Rewards" in check.problems[0]


def test_check_page_dates_outside_the_window(october):
    check = check_page(info(), [row(day=date(2026, 9, 5)), row("2", day=date(2026, 10, 5))], october)
    assert not check.ok and "1 line(s) have a sale date outside" in check.problems[0]
    assert "10/01/2026 to 10/31/2026" in check.problems[0]


def test_check_page_tire_missing_from_the_dropdown(october):
    check = check_page(info(options=[NOKIAN]), [row(day=date(2026, 10, 5))], october)
    assert not check.ok and "Not in the website's product list" in check.problems[0]


def test_check_page_warns_about_existing_rows_and_unreadable_dates(october):
    existing = [GridRow(date(2026, 10, 5), "1", ALTIMAX, 4)]
    check = check_page(info(rows=existing, window=(None, None)), [row(day=date(2026, 10, 5))], october)
    assert check.ok and len(check.warnings) == 2


# -------------------------------------------------------------- config + launch
def test_config_defaults_and_errors(app_home):
    cfg = load_config()
    assert cfg.browser == "auto" and cfg.timeouts["add"] == 25 and cfg.live_url.startswith("https://")
    assert (paths.data_dir() / "config.toml").is_file()
    (paths.data_dir() / "config.toml").write_text("[site\nbroken")
    with pytest.raises(FillError, match="config.toml could not be read"):
        load_config()


def test_missing_browser_gives_a_plain_message():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        with pytest.raises(FillError, match="Chrome or Microsoft Edge could not be started"):
            launch_chromium(p, "no-such-browser", True)


def test_closed_session_refuses_work():
    cfg = load_config(paths.defaults_dir() / "config.toml")
    session = BrowserSession(cfg, test_mode=True, headless=True)
    with pytest.raises(FillError, match="not open"):
        session.call(lambda s: 1)


def test_saved_page_is_found():
    assert saved_page_path().name == "ATD ProRewards - Submit Claim.html"


# ------------------------------------------------------------------------ CLI
def test_cli_probe_page(app_home, capsys):
    assert main(["probe-page", "--headless"]) == 0
    out = capsys.readouterr().out
    assert "Mode: TEST" in out and "MISSING" not in out
    assert "Products in list:    77" in out
    assert "All the fields needed to enter sales were found." in out


def test_cli_fill_one(app_home, capsys):
    assert main(["fill-one", "--date", "09/05/2026", "--invoice", "214341", "--tire", ALTIMAX,
                 "--qty", "4", "--headless"]) == 0
    assert "added, verified" in capsys.readouterr().out


def test_cli_fill_one_with_a_bad_tire_and_a_bad_date(app_home, capsys):
    assert main(["fill-one", "--date", "09/05/2026", "--invoice", "1", "--tire", "Nope", "--qty", "4",
                 "--headless"]) == 1
    assert "not in the website's product list" in capsys.readouterr().out
    assert main(["fill-one", "--date", "5 Sep", "--invoice", "1", "--tire", ALTIMAX, "--qty", "4",
                 "--headless"]) == 1
    assert "mm/dd/yyyy" in capsys.readouterr().out


REPORT = str(FIXTURES / "Material-Sales.pdf")
CLAIMFORM = str(FIXTURES / "ClaimForm.pdf")


def test_cli_fill_all_stops_on_a_month_mismatch(app_home, capsys):
    assert main(["fill-all", REPORT, "--claimform", CLAIMFORM, "--headless"]) == 1
    assert "STOPPED" in capsys.readouterr().out


def test_cli_fill_all_in_test_mode_with_its_own_record(app_home, tmp_path, capsys):
    folder = str(tmp_path / "inv")
    main(["demo-invoices", REPORT, folder, "--count", "100"])
    capsys.readouterr()
    args = ["fill-all", REPORT, "--invoices", folder, "--claimform", CLAIMFORM,
            "--ignore-program-mismatch", "--headless", "--limit", "3"]
    assert main(args) == 0
    out = capsys.readouterr().out
    assert "Mode: TEST" in out and "Entered:           3 lines, qty 9" in out
    assert "PDFs uploaded:     3" in out and "Nothing has been submitted" in out
    assert (paths.data_dir() / "state_test.json").is_file()
    assert not (paths.data_dir() / "state.json").exists()  # the real record is untouched
    assert len(list(paths.output_dir().glob("report_*.csv"))) == 1
    # the next run carries on with the next three lines, because the first three are recorded
    assert main(args) == 0
    second = capsys.readouterr().out
    assert "Entered:           3 lines, qty 9" in second  # 214629, 214632, 214645
    assert "214629" in second and "214288" not in second
    # --fresh forgets the test record, so the first three are entered again
    assert main(args + ["--fresh"]) == 0
    assert "Entered:           3 lines, qty 9" in capsys.readouterr().out


def test_cli_fill_all_nothing_ready(app_home, tmp_path, capsys):
    folder = str(tmp_path / "inv")
    main(["demo-invoices", REPORT, folder, "--count", "100"])
    capsys.readouterr()
    args = ["fill-all", REPORT, "--invoices", folder, "--claimform", CLAIMFORM,
            "--ignore-program-mismatch", "--headless"]
    assert main(args) == 0
    capsys.readouterr()
    assert main(args) == 0  # everything is recorded now
    out = capsys.readouterr().out
    assert "Nothing is ready to enter." in out and "need your decision" in out


# ------------------------------------------------- invoice PDFs are optional
def test_run_without_any_pdf_enters_sales_only(page, tmp_path):
    rows = [replace(r, pdf_path=None) for r in four_rows(tmp_path)]
    summary, _state, events = run_filler(page, rows, tmp_path)
    assert len(summary.entered) == 4 and summary.uploaded == [] and summary.upload_failed == []
    messages = [e.get("message", "") for e in events]
    assert sum("only the sales are entered" in m for m in messages) == 1  # said once, not per invoice
    assert not any("no PDF to upload" in m for m in messages)
    assert page.call(lambda s: stub(s, "window.__stub.files.length")) == 0


# ----------------------------------------------------- the quick ways to type
def test_model_only_then_tab_picks_the_exact_tire(page):
    def job(claim, _s):
        claim.select_product(ALTIMAX, "Altimax RT45")
        return claim._selected_product()
    assert on_page(page, job) == ALTIMAX


def test_a_model_that_lands_on_the_wrong_tire_falls_back_to_the_exact_name(page):
    def job(claim, _s):
        claim.select_product(TOYO, "Altimax RT45")  # Tab would pick the Altimax: wrong, so redo by name
        return claim._selected_product()
    assert on_page(page, job) == TOYO


def test_a_model_that_matches_nothing_still_selects_by_name(page):
    def job(claim, _s):
        claim.select_product(NOKIAN, "no such model")
        return claim._selected_product()
    assert on_page(page, job) == NOKIAN


def test_boxes_are_filled_by_pasting_and_fall_back_to_typing(page):
    def job(claim, _s):
        pasted, typed = [], []
        kb = claim.page.keyboard
        insert, type_ = kb.insert_text, kb.type
        kb.insert_text = lambda t, *a, **k: (pasted.append(t), insert(t, *a, **k))[1]
        kb.type = lambda t, *a, **k: (typed.append(t), type_(t, *a, **k))[1]
        claim.set_invoice("214341")
        claim.set_qty(3)
        return pasted, typed
    pasted, typed = on_page(page, job)
    assert pasted == ["214341", "3"] and typed == []


def test_a_box_that_ignores_pasting_is_typed_instead(page):
    def job(claim, _s):
        claim.page.keyboard.insert_text = lambda *a, **k: None  # a page that only reacts to key presses
        claim.set_invoice("777888")
        return claim.loc("invoice").first.input_value()
    assert on_page(page, job) == "777888"
