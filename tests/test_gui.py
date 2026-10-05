"""Drives the real window (hidden) through the same steps a person would. Skipped if Tk cannot open."""
import re
from dataclasses import replace
from datetime import date
from pathlib import Path

import pytest

from auto_spiffer import paths
from auto_spiffer.brands import BrandTable
from auto_spiffer.catalog import list_history, save_catalog
from auto_spiffer.catalog_import import parse_claimform
from auto_spiffer.demo_pdfs import make_demo_invoices
from auto_spiffer.report_parse import parse_report
from auto_spiffer.session import Session
from auto_spiffer.settings import Settings
from auto_spiffer.tirespec import NoiseRules

tk = pytest.importorskip("tkinter")
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


@pytest.fixture
def invoice_folder(tmp_path):
    folder = tmp_path / "inv"
    make_demo_invoices(parse_report(REPORT), folder, count=100)
    return folder


def make_app(brands, noise, restore=False):
    from auto_spiffer.gui.app import App
    try:
        root = tk.Tk()
    except tk.TclError:
        pytest.skip("Tk cannot open a window here")
    root.withdraw()
    session = Session(brands=brands, noise=noise)  # loads the saved tire list, if any
    return root, App(root, session=session, settings=Settings.load(), synchronous=True, restore=restore)


@pytest.fixture
def app(app_home, brands, noise, october):
    save_catalog(october)  # the saved tire list is October's, the report is September's
    root, application = make_app(brands, noise)
    yield application
    try:
        root.destroy()
    except tk.TclError:
        pass


def load_everything(app, invoice_folder, override=True):
    load = app.pages["load"]
    load.set_report(str(REPORT))
    load.add_paths([str(invoice_folder)])
    if override:
        load.override_var.set(True)
        load._override_changed()
    load.read_files()


def row_values(app):
    tree = app.pages["review"].tree
    return [tree.item(i, "values") for i in tree.get_children()]


# --------------------------------------------------------- T25: window shell
def test_window_builds_with_four_pages(app):
    assert set(app.pages) == {"load", "review", "run", "tires"}
    assert app.current == "load"
    assert app.nav["load"].cget("text").endswith("Load files")


def test_later_pages_are_locked_until_files_are_read(app):
    assert not app.is_unlocked("review") and not app.is_unlocked("run")
    assert app.show("review") is False
    assert "Load and read the files first" in app.hint.cget("text")
    assert app.current == "load"
    assert app.show("tires") is True and app.current == "tires"
    assert app.show("load") is True and app.hint.cget("text") == ""


def test_sidebar_status_lines(app):
    assert app.month_label.cget("text") == "No month loaded"
    assert "October 2026 Pro Rewards" in app.tire_status.cget("text")


# ------------------------------------------------------------- T26: load page
def test_load_report_and_invoices_show_status(app, invoice_folder):
    load = app.pages["load"]
    load.set_report(str(REPORT))
    assert "32 rows read (29 tires, 3 ignored)" in load.report_status.cget("text")
    load.add_paths([str(invoice_folder)])
    assert load.invoice_list.size() == 27
    assert "27 PDFs for 27 invoice numbers" in load.invoice_status.cget("text")
    assert "report invoices have no PDF" not in load.invoice_status.cget("text")


def test_a_bad_report_shows_a_plain_error(app):
    load = app.pages["load"]
    load.set_report(str(FIXTURES / "example_invoice.pdf"))
    assert "Material Sales" in load.report_status.cget("text")
    assert not load.read_button.instate(["!disabled"])


def test_missing_invoices_are_flagged_before_reading(app, tmp_path):
    folder = tmp_path / "few"
    make_demo_invoices(parse_report(REPORT), folder, count=3)
    load = app.pages["load"]
    load.set_report(str(REPORT))
    load.add_paths([str(folder)])
    assert "23 report invoices have no PDF" in load.invoice_status.cget("text")


def test_month_mismatch_banner_blocks_reading_until_overridden(app, invoice_folder):
    load = app.pages["load"]
    load.set_report(str(REPORT))
    assert "October 2026 Pro Rewards" in load.banner.cget("text")
    assert "09/01/2026 to 09/30/2026" in load.banner.cget("text")
    assert not load.read_button.instate(["!disabled"])
    assert "different month" in load.reason.cget("text")
    load.override_var.set(True)
    load._override_changed()
    assert load.read_button.instate(["!disabled"])


def test_read_files_unlocks_review_and_shows_it(app, invoice_folder):
    load_everything(app, invoice_folder)
    assert app.is_unlocked("review") and app.current == "review"
    assert app.month_label.cget("text") == "September 2026"
    assert app.workspace_label.cget("text") == "Workspace: 2026-09"
    assert (paths.months_dir() / "2026-09" / "Material-Sales.pdf").is_file()


def test_reading_without_a_tire_list_is_blocked(app_home, brands, noise):
    root, application = make_app(brands, noise)  # nothing saved
    try:
        load = application.pages["load"]
        assert "No tire list is loaded" in load.banner.cget("text")
        load.set_report(str(REPORT))
        assert "Load a tire list" in load.reason.cget("text")
    finally:
        root.destroy()


def test_remove_and_clear_invoices(app, invoice_folder):
    load = app.pages["load"]
    load.add_paths([str(invoice_folder)])
    load.invoice_list.selection_set(0, 1)
    load.remove_selected()
    assert load.invoice_list.size() == 25
    load.clear_invoices()
    assert load.invoice_list.size() == 0 and "Optional" in load.invoice_status.cget("text")


def test_new_month_clears_the_page(app, invoice_folder):
    load_everything(app, invoice_folder)
    load = app.pages["load"]
    load.new_month()
    assert app.current == "load" and load.report_var.get() == "" and load.invoice_list.size() == 0
    assert not app.is_unlocked("review")


# ------------------------------------------------------------ T27: review page
def test_review_table_and_cards(app, invoice_folder):
    load_everything(app, invoice_folder)
    review = app.pages["review"]
    rows = row_values(app)
    assert len(rows) == 26
    assert [review.cards[k][1].cget("text") for k in ("ready", "attention", "not_eligible", "problem")] == \
        ["17", "2", "7", "0"]
    assert "qty" not in review.cards  # the total number of tires is not shown here
    first = rows[1]
    assert first[0] == "09/05/2026" and first[1] == "214341" and first[3] == "General Altimax RT45 - Passenger Tires"
    assert first[4] == "4" and first[5] == "Yes" and first[6] == "Ready"
    merged = next(r for r in rows if r[1] == "214962")
    assert merged[4] == "4*" and merged[3] == "(choose a tire...)" and merged[6] == "Attention"
    assert "3 line(s)" in review.note.cget("text")
    assert "Ready 17" in review.summary.cget("text")


def test_clicking_a_card_filters_the_table(app, invoice_folder):
    load_everything(app, invoice_folder)
    review = app.pages["review"]
    review.set_filter("attention")
    assert [r[1] for r in row_values(app)] == ["214655", "214962"]
    review.set_filter("not_eligible")
    assert len(row_values(app)) == 7
    review.set_filter("not_eligible")  # click again to clear
    assert len(row_values(app)) == 26


def test_continue_is_blocked_while_rows_need_attention(app, invoice_folder):
    load_everything(app, invoice_folder)
    review = app.pages["review"]
    assert not review.continue_button.instate(["!disabled"])
    assert "2 line(s) still need your decision" in review.why.cget("text")
    assert app.show("run") is False


# ----------------------------------------------------- T28: fix, exclude, export
def attention_index(app, invoice):
    return next(i for i, r in enumerate(app.session.rows) if r.invoice == invoice)


def test_fix_dialog_resolves_a_row(app, invoice_folder):
    load_everything(app, invoice_folder)
    review = app.pages["review"]
    dialog = review.open_fix(attention_index(app, "214655"))
    assert dialog.guesses[0][0].site_text == "Nokian One HT - Light Truck Tires"
    assert "HT" in dialog.matched.result.reason
    dialog.choose(dialog.guesses[0][0])
    assert dialog.accept()
    assert dialog.closed
    assert review.cards["ready"][1].cget("text") == "18" and review.cards["attention"][1].cget("text") == "1"
    assert row_values(app)[attention_index(app, "214655")][3] == "Nokian One HT - Light Truck Tires"


def test_the_choice_is_remembered_after_restarting(app, invoice_folder, brands, noise):
    load_everything(app, invoice_folder)
    dialog = app.pages["review"].open_fix(attention_index(app, "214655"))
    dialog.choose(dialog.guesses[0][0])
    dialog.accept()
    app.close()
    root2, app2 = make_app(brands, noise, restore=True)
    try:
        assert app2.current == "review"
        assert app2.pages["review"].cards["attention"][1].cget("text") == "1"
    finally:
        root2.destroy()


def test_fix_dialog_search_filters_the_list(app, invoice_folder):
    load_everything(app, invoice_folder)
    dialog = app.pages["review"].open_fix(attention_index(app, "214655"))
    assert dialog.all_list.size() == 75
    dialog.search_var.set("pirelli scorpion")
    assert dialog.all_list.size() == 6 and all("Pirelli Scorpion" in t.site_text for t in dialog.shown)
    dialog.all_list.selection_set(0)
    dialog._picked_any()
    assert dialog.choice is dialog.shown[0]
    dialog.close()


def test_fix_dialog_mark_not_eligible_and_change_quantity(app, invoice_folder):
    load_everything(app, invoice_folder)
    review = app.pages["review"]
    dialog = review.open_fix(attention_index(app, "214962"))
    dialog.skip_var.set(True)
    dialog.qty_var.set("2")
    assert dialog.accept()
    assert review.cards["not_eligible"][1].cget("text") == "8"
    assert app.session.counts()["not_eligible"] == (8, 21)  # 19 + this line's quantity, now 2


def test_fix_dialog_rejects_a_bad_quantity(app, invoice_folder):
    load_everything(app, invoice_folder)
    dialog = app.pages["review"].open_fix(attention_index(app, "214655"))
    for bad in ("abc", "0", "1000"):
        dialog.qty_var.set(bad)
        assert dialog.accept() is False
        assert not dialog.closed
    assert len(app.messages) == 3
    dialog.close()


def test_fix_dialog_without_a_choice_changes_nothing(app, invoice_folder):
    load_everything(app, invoice_folder)
    dialog = app.pages["review"].open_fix(attention_index(app, "214655"))
    assert dialog.accept()
    assert app.pages["review"].cards["attention"][1].cget("text") == "2"


def test_exclude_and_include_a_row(app, invoice_folder):
    load_everything(app, invoice_folder)
    review = app.pages["review"]
    index = attention_index(app, "214341")
    review.tree.selection_set(str(index))
    review._update_buttons()
    assert review.exclude_button.cget("text") == "Exclude row"
    review.toggle_exclude()
    assert row_values(app)[index][6] == "Excluded"
    assert review.cards["ready"][1].cget("text") == "16"
    assert review.exclude_button.cget("text") == "Include row"
    review.toggle_exclude()
    assert row_values(app)[index][6] == "Ready"


def test_skip_unresolved_unlocks_run(app, invoice_folder):
    load_everything(app, invoice_folder)
    review = app.pages["review"]
    review.skip_var.set(True)
    review._skip_changed()
    assert review.continue_button.instate(["!disabled"])
    assert app.is_unlocked("run")
    review.go_run()
    assert app.current == "run"
    text = app.pages["run"].log.get("1.0", "end")
    assert "Ready to enter: 17 line(s), 17 invoice PDF(s)." in text
    assert "qty" not in text.lower().replace("estimated", "")  # no quantity totals on the Run page
    assert "To enter:             17 rows" in text


def test_export_csv(app, invoice_folder, tmp_path):
    load_everything(app, invoice_folder)
    out = app.pages["review"].save_csv(str(tmp_path / "out" / "report.csv"))
    lines = out.read_text(encoding="utf-8-sig").splitlines()
    assert len(lines) == 1 + 26 + 3
    assert any("Saved to" in m for _t, m in app.messages)


def test_resolving_everything_unlocks_run(app, invoice_folder):
    load_everything(app, invoice_folder)
    review = app.pages["review"]
    for invoice, tire in (("214655", "Nokian One HT - Light Truck Tires"),
                          ("214962", "Hercules Terra Trac A/T - Light Truck Tires")):
        dialog = review.open_fix(attention_index(app, invoice))
        dialog.choose(app.session.catalog.find_by_text(tire))
        dialog.accept()
    assert review.continue_button.instate(["!disabled"]) and review.why.cget("text") == ""
    assert app.is_unlocked("run")


# ------------------------------------------------------- T29: the tire list page
def test_tire_list_shows_the_saved_list(app):
    tires = app.pages["tires"]
    app.show("tires")
    assert len(tires.tree.get_children()) == 77
    assert "October 2026 Pro Rewards" in tires.header.cget("text")
    assert "75 tires, 2 wheels" in tires.header.cget("text")
    tires.search_var.set("grabber")
    assert len(tires.tree.get_children()) == 5
    assert tires.count_label.cget("text") == "5 of 77 shown"


def test_updating_the_tire_list_with_a_change(app, october):
    tires = app.pages["tires"]
    newer = replace(october, program="November 2026 Pro Rewards", program_start=date(2026, 11, 1),
                    program_end=date(2026, 11, 30),
                    items=[i for i in october.items if i.site_text != "Falken Rubitrek A/T - Light Truck Tires"])
    tires.apply_update(newer)
    assert len(tires.tree.get_children()) == 76
    assert "November 2026" in tires.header.cget("text")
    assert "November 2026 Pro Rewards" in app.tire_status.cget("text")
    assert len(list_history()) == 1
    assert any("tire list is now November 2026" in m for _t, m in app.messages)


def test_begin_update_reads_the_pdf(app):
    tires = app.pages["tires"]
    tires.begin_update(str(FIXTURES / "ClaimForm.pdf"))
    result, diff = tires.pending
    assert len(result.catalog.items) == 77 and not diff.has_changes


def test_history_can_be_viewed_read_only(app, october):
    tires = app.pages["tires"]
    tires.apply_update(replace(october, program="November 2026 Pro Rewards"))
    tires.view_history(list_history()[0])
    assert "October 2026 Pro Rewards" in tires.header.cget("text")
    assert "read only" in tires.view_banner.cget("text")
    tires.show_current()
    assert "November 2026 Pro Rewards" in tires.header.cget("text")


def test_export_tire_list(app, tmp_path):
    out = app.pages["tires"].save_csv(str(tmp_path / "tires.csv"))
    assert len(out.read_text(encoding="utf-8-sig").splitlines()) == 78


def test_updating_the_list_rematches_an_open_month(app, invoice_folder, october):
    load_everything(app, invoice_folder)
    smaller = replace(october, items=[i for i in october.items
                                       if i.site_text != "General Altimax RT45 - Passenger Tires"])
    app.pages["tires"].apply_update(smaller)
    assert app.pages["review"].cards["ready"][1].cget("text") == "15"


# --------------------------------------------- T30: gating, workspace, remembering
def test_open_recent_months(app, invoice_folder):
    load_everything(app, invoice_folder)
    app.pages["load"].new_month()
    load = app.pages["load"]
    load._fill_recent()
    assert load.recent_menu.index("end") == 0
    assert "September 2026" in load.recent_menu.entrycget(0, "label")
    app.open_workspace(app.session.recent_workspaces()[0])
    assert app.current == "review" and len(row_values(app)) == 26


def test_window_remembers_its_size_and_last_month(app, invoice_folder):
    load_everything(app, invoice_folder)
    app.root.deiconify()
    app.root.geometry("1180x700+50+50")
    app.root.update()
    app.close()
    saved = Settings.load()
    assert saved.get("last_workspace") == "2026-09"
    assert saved.get("window_geometry") == "1180x700"


def test_restoring_the_last_month_on_start(app, invoice_folder, brands, noise):
    load_everything(app, invoice_folder)
    app.close()
    root2, app2 = make_app(brands, noise, restore=True)
    try:
        assert app2.current == "review" and len(row_values(app2)) == 26
        assert app2.month_label.cget("text") == "September 2026"
    finally:
        root2.destroy()


def test_a_missing_month_folder_is_ignored_on_start(app_home, brands, noise, october):
    save_catalog(october)
    settings = Settings.load()
    settings.set("last_workspace", "1999-01")
    settings.save()
    root, application = make_app(brands, noise, restore=True)
    try:
        assert application.current == "load"
    finally:
        root.destroy()


# ------------------------------------------------- invoice PDFs are optional
def test_loading_without_invoice_pdfs_is_fine(app):
    load = app.pages["load"]
    load.set_report(str(REPORT))
    load.override_var.set(True)
    load._override_changed()
    assert "Optional" in load.invoice_status.cget("text") and "upload the invoice PDFs yourself" in load.invoice_status.cget("text")
    assert "(optional)" in load.invoice_list.master.master.cget("text")
    assert load.read_button.instate(["!disabled"])
    load.read_files()
    review = app.pages["review"]
    assert [review.cards[k][1].cget("text") for k in ("ready", "attention", "not_eligible", "problem")] == \
        ["17", "2", "7", "0"]
    assert {v[5] for v in row_values(app)} == {"-"}  # no "No PDF" noise
    review.skip_var.set(True)
    review._skip_changed()
    app.show("run")
    assert "No PDFs will be uploaded" in app.pages["run"].log.get("1.0", "end")


def test_settings_can_ignore_loaded_pdfs(app, invoice_folder):
    load_everything(app, invoice_folder)
    assert {v[5] for v in row_values(app)} >= {"Yes"}
    dialog = app.open_settings()
    dialog.use_var.set(True)  # "I upload the invoice PDFs myself"
    dialog.save()
    assert app.session.use_pdfs is False
    assert {v[5] for v in row_values(app)} == {"-"}
    assert Settings.load().get("use_invoice_pdfs") is False


# ------------------------------------------------- re-enter this month
def record_some(app, *invoices):
    from auto_spiffer.state import State
    state = State.load()
    for invoice in invoices:
        row = next(r for r in app.session.result.claim_rows if r.invoice == invoice)
        state.mark_entered(row.invoice, row.product_text, row.qty, row.sale_date_str)
    state.save()
    app.session.analyze()
    app.refresh_all()


def test_reenter_button_is_off_until_something_is_recorded(app, invoice_folder):
    load_everything(app, invoice_folder)
    app.pages["review"].skip_var.set(True)
    app.pages["review"]._skip_changed()
    app.show("run")
    run = app.pages["run"]
    assert run.reenter_button.instate(["disabled"])
    assert run.reenter_month() is False and app.messages == []


def test_reenter_asks_first_with_a_clear_warning_and_can_be_declined(app, invoice_folder):
    load_everything(app, invoice_folder)
    record_some(app, "214341", "214533")
    review = app.pages["review"]
    assert [v[6] for v in row_values(app)].count("Already entered") == 2
    assert "recorded as already entered" in review.note.cget("text") and "Re-enter this month" in review.note.cget("text")
    review.skip_var.set(True)
    review._skip_changed()
    app.show("run")
    run = app.pages["run"]
    assert run.reenter_button.instate(["!disabled"])

    app.confirm_answer = False
    assert run.reenter_month() is False
    title, message = app.messages[-1]
    assert title == "Re-enter this month" and "214341" in message and "214533" in message
    assert "did NOT submit" in message and "removed from the program" in message
    assert [v[6] for v in row_values(app)].count("Already entered") == 2  # declined: nothing changed


def test_reenter_makes_the_lines_ready_again(app, invoice_folder):
    load_everything(app, invoice_folder)
    record_some(app, "214341", "214533")
    review = app.pages["review"]
    review.skip_var.set(True)
    review._skip_changed()
    app.show("run")
    run = app.pages["run"]
    assert run.reenter_month() is True
    assert "Forgot 2 record(s)" in run.log.get("1.0", "end")
    statuses = [v[6] for v in row_values(app)]
    assert statuses.count("Ready") == 17 and "Already entered" not in statuses
    assert run.reenter_button.instate(["disabled"])  # nothing left to forget
    assert review.note.cget("text").count("Re-enter") == 0


def test_reenter_is_not_offered_during_a_run(app, invoice_folder):
    load_everything(app, invoice_folder)
    record_some(app, "214341")
    app.pages["review"].skip_var.set(True)
    app.pages["review"]._skip_changed()
    run = app.pages["run"]
    run.running = True
    try:
        run.refresh()
        assert run.reenter_button.instate(["disabled"]) and run.reenter_month() is False
    finally:
        run.running = False
