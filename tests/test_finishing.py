"""T38 and T39: settings, plain errors, first-run checks, the self-check, and the packaged program."""
import logging
import re
import subprocess
import sys
from pathlib import Path

import pytest

from auto_spiffer import paths
from auto_spiffer.browser import browser_problem, installed_browsers
from auto_spiffer.fill import FillError, RunControl, load_config, update_config
from auto_spiffer.gui import selftest
from auto_spiffer.settings import Settings

tk = pytest.importorskip("tkinter")
from test_gui import (app, brands, invoice_folder, load_everything, make_app, noise, october,  # noqa: E402,F401
                      row_values, REPORT)

ROOT = Path(__file__).resolve().parent.parent
EXE = ROOT / "dist" / "AutoSpiffer" / "AutoSpiffer.exe"


# ------------------------------------------------------------ editing the config
def test_update_config_changes_only_the_two_lines(app_home):
    path = paths.ensure_data_file("config.toml")
    before = path.read_text()
    update_config(live_url="https://example.org/portal", browser="msedge")
    after = path.read_text()
    cfg = load_config()
    assert cfg.live_url == "https://example.org/portal" and cfg.browser == "msedge"
    assert cfg.selectors and cfg.never_click  # everything else is intact
    assert after.count("\n") == before.count("\n") and "# How Auto Spiffer talks" in after
    changed = [(a, b) for a, b in zip(before.splitlines(), after.splitlines()) if a != b]
    assert len(changed) == 2


@pytest.mark.parametrize("kwargs, message", [
    ({"live_url": "prorewards.acbrewards.com"}, "must start with http"),
    ({"live_url": "https://bad address"}, "no spaces"),
    ({"browser": "firefox"}, "must be one of"),
])
def test_update_config_refuses_bad_values(app_home, kwargs, message):
    before = paths.ensure_data_file("config.toml").read_text()
    with pytest.raises(FillError, match=message):
        update_config(**kwargs)
    assert paths.ensure_data_file("config.toml").read_text() == before


# --------------------------------------------------------------- browser checks
def test_browser_problem_messages(monkeypatch):
    import auto_spiffer.browser as b
    monkeypatch.setattr(b, "installed_browsers", lambda: [])
    assert "Neither Google Chrome nor Microsoft Edge" in b.browser_problem("auto")
    assert "Google Chrome was chosen" in b.browser_problem("chrome")
    monkeypatch.setattr(b, "installed_browsers", lambda: ["msedge"])
    assert b.browser_problem("auto") is None and b.browser_problem("msedge") is None
    assert "Google Chrome was chosen" in b.browser_problem("chrome")


def test_installed_browsers_returns_known_names():
    assert set(installed_browsers()) <= {"chrome", "msedge"}


def test_first_run_check_warns_when_no_browser(app_home, brands, noise, october, monkeypatch):
    from auto_spiffer.catalog import save_catalog
    save_catalog(october)
    monkeypatch.setattr("auto_spiffer.gui.app.browser_problem",
                        lambda preferred="auto": "Neither Google Chrome nor Microsoft Edge was found.")
    from auto_spiffer.gui.app import App
    from auto_spiffer.session import Session
    root = tk.Tk()
    root.withdraw()
    try:
        application = App(root, session=Session(brands=brands, noise=noise), settings=Settings.load(),
                          synchronous=True, restore=False)
        assert application.browser_problem
        assert any(t == "A browser is needed" and "still work without it" in m
                   for t, m in application.messages)
    finally:
        root.destroy()


def test_no_warning_when_a_browser_exists(app):
    assert app.browser_problem is None and app.messages == []


# ------------------------------------------------------------- the Settings window
def test_settings_window_shows_the_current_values(app):
    dialog = app.open_settings()
    try:
        assert dialog.url_var.get().startswith("https://prorewards")
        assert dialog.browser_value() == "auto"
        assert dialog.allow_var.get() is False
    finally:
        dialog.close()


def test_saving_settings_takes_effect(app):
    dialog = app.open_settings()
    dialog.url_var.set("https://example.org/claims")
    dialog.browser_var.set("Microsoft Edge")
    dialog.allow_var.set(True)
    assert dialog.save() and dialog.closed
    assert load_config().live_url == "https://example.org/claims" and load_config().browser == "msedge"
    assert app.session.allow_missing_pdf is True
    saved = Settings.load()
    assert saved.get("allow_missing_pdf") is True


def test_a_bad_address_keeps_the_window_open(app):
    dialog = app.open_settings()
    dialog.url_var.set("not a web address")
    assert dialog.save() is False and not dialog.closed
    assert any(t == "Settings" and "must start with http" in m for t, m in app.messages)
    dialog.close()


def test_cancel_changes_nothing(app):
    before = paths.ensure_data_file("config.toml").read_text()
    dialog = app.open_settings()
    dialog.url_var.set("https://example.org/other")
    dialog.close()
    assert paths.ensure_data_file("config.toml").read_text() == before
    assert app.session.allow_missing_pdf is False


def test_allowing_missing_pdfs_changes_the_review(app, tmp_path):
    """With SOME PDFs loaded, sales without one are held back, unless the setting allows them."""
    from auto_spiffer.demo_pdfs import make_demo_invoices
    from auto_spiffer.report_parse import parse_report
    few = tmp_path / "few"
    make_demo_invoices(parse_report(REPORT), few, count=3)
    load = app.pages["load"]
    load.set_report(str(REPORT))
    load.add_paths([str(few)])
    load.override_var.set(True)
    load._override_changed()
    load.read_files()
    review = app.pages["review"]
    assert review.cards["ready"][1].cget("text") == "2" and review.cards["problem"][1].cget("text") == "15"
    assert any("no invoice PDF" in " ".join(r.notes) for r in app.session.rows if r.status == "problem")
    dialog = app.open_settings()
    dialog.allow_var.set(True)
    dialog.save()
    assert review.cards["ready"][1].cget("text") == "17" and review.cards["problem"][1].cget("text") == "0"


def test_settings_link_is_in_the_sidebar(app):
    # the sidebar has a clickable Settings entry, not the old "coming later" placeholder
    texts = []

    def walk(widget):
        for child in widget.winfo_children():
            if child.winfo_class() == "Label":
                texts.append(child.cget("text"))
            walk(child)
    walk(app.root)
    assert "Settings" in texts and not any("coming later" in t for t in texts)


# ----------------------------------------------------------------- plain errors
def test_expected_problems_are_shown_in_plain_words(app):
    app.report_exception(FillError("The browser window was closed."), "Run")
    assert app.messages[-1] == ("Run", "The browser window was closed.")


def test_unexpected_problems_hide_the_details_and_go_to_the_log(app, caplog):
    with caplog.at_level(logging.ERROR, logger="auto_spiffer"):
        app.root.report_callback_exception(RuntimeError, RuntimeError("secret internal detail"), None)
    title, message = app.messages[-1]
    assert "Something unexpected went wrong" in message and "log file" in message
    assert "secret internal detail" not in message and "Traceback" not in message
    assert any("secret internal detail" in str(r.exc_info[1]) for r in caplog.records if r.exc_info)


def test_closing_during_a_run_asks_first(app):
    run = app.pages["run"]
    run.running, run.control = True, RunControl()
    try:
        app.close()
    finally:
        run.running = False
    assert any(t == "A run is in progress" and "stops after the current line" in m
               for t, m in app.messages)
    assert run.control.stopped  # shutdown told the run to stop


# ---------------------------------------------------------------------- self-check
def test_selftest_passes_from_source(app_home):
    code = selftest.run(["--selftest"])
    text = (paths.output_dir() / "selftest.txt").read_text()
    assert code == 0 and "ALL PASSED" in text and text.count("OK ") >= 6
    assert "FAIL" not in text


def test_selftest_with_the_browser(app_home):
    if not installed_browsers():
        pytest.skip("no browser installed")
    assert selftest.run(["--selftest", "--selftest-browser"]) == 0
    assert "opened the saved claim page: 77 products" in (paths.output_dir() / "selftest.txt").read_text()


def test_selftest_reports_a_failure_plainly(app_home, monkeypatch):
    monkeypatch.setattr(selftest, "BASIC", [("broken piece", lambda: (_ for _ in ()).throw(RuntimeError("nope")))])
    assert selftest.run(["--selftest"]) == 1
    text = (paths.output_dir() / "selftest.txt").read_text()
    assert "FAIL  broken piece: RuntimeError: nope" in text and "1 CHECK(S) FAILED" in text


def test_the_exe_entry_point_routes_to_the_selftest(app_home, monkeypatch):
    sys.path.insert(0, str(ROOT))
    import run_app
    monkeypatch.setattr(sys, "argv", ["AutoSpiffer.exe", "--selftest"])
    assert run_app.main() == 0


# ------------------------------------------------------- documentation and packaging
def test_readme_covers_the_monthly_steps():
    text = (ROOT / "README.md").read_text(encoding="utf-8")
    for needle in ("never submits", "Update from ClaimForm.pdf", "Read files and continue", "Needs attention",
                   "Test mode", "output\\auto_spiffer.log", "--selftest"):
        assert needle.lower() in text.lower(), needle


def test_build_script_includes_what_the_exe_needs():
    text = (ROOT / "build_exe.py").read_text(encoding="utf-8")
    for needle in ("--windowed", "--collect-all", "playwright", "defaults", "test_page"):
        assert needle in text


@pytest.mark.skipif(not EXE.is_file(), reason="the .exe has not been built (python build_exe.py)")
def test_the_built_exe_passes_its_own_selftest():
    out = EXE.parent / "output" / "selftest.txt"
    out.unlink(missing_ok=True)
    result = subprocess.run([str(EXE), "--selftest"], timeout=180)
    assert result.returncode == 0
    text = out.read_text()
    assert "ALL PASSED" in text and "FAIL" not in text
