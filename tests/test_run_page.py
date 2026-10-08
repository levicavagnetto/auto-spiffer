"""The Run page, driven like a person would: open the site (the saved page, headless), start,
pause, stop. Skipped if Tk or a browser is not available."""
import time
from dataclasses import replace

import pytest

from auto_spiffer import paths
# The fixtures and helpers of the window tests are reused here.
from test_gui import (REPORT, app, brands, invoice_folder, load_everything, make_app, noise, october,  # noqa: F401
                      row_values)


def to_run_page(app, invoice_folder, test_mode=True):
    load_everything(app, invoice_folder)
    review = app.pages["review"]
    review.skip_var.set(True)
    review._skip_changed()
    app.browser_headless = True
    run = app.pages["run"]
    run.test_var.set(test_mode)
    run._options_changed()
    app.show("run")
    return run


def wait_for_run(app, run, timeout=240, each=None):
    end = time.time() + timeout
    while run.running and time.time() < end:
        app.root.update()
        if each:
            each()
        time.sleep(0.05)
    app.root.update()
    assert not run.running, "the run did not finish in time"


def log_text(run):
    return run.log.get("1.0", "end")


def open_or_skip(app, run):
    run.open_site()
    if not run.browser_open():
        reason = app.messages[-1][1] if app.messages else "unknown"
        pytest.skip(f"no browser available: {reason}")


def test_run_page_starts_idle_with_the_plan(app, invoice_folder):
    run = to_run_page(app, invoice_folder)
    assert run.start_button.instate(["disabled"]) and run.pause_button.instate(["disabled"])
    assert run.open_button.instate(["!disabled"])
    assert run.counter.cget("text") == "0 of 17 sales"
    assert "Ready to enter: 17 line(s)" in log_text(run) and "qty" not in log_text(run)
    assert "TEST MODE" in run.mode_banner.cget("text")


def test_start_without_a_browser_does_nothing(app, invoice_folder):
    run = to_run_page(app, invoice_folder)
    run.start_run()
    assert not run.running and run.future is None


def test_run_page_enters_everything_in_test_mode(app, invoice_folder):
    run = to_run_page(app, invoice_folder)
    try:
        open_or_skip(app, run)
        assert run.start_button.instate(["!disabled"]) and run.open_button.instate(["!disabled"])
        assert "SAVED page" in log_text(run)
        run.start_run()
        assert run.running and run.pause_button.instate(["!disabled"]) and run.stop_button.instate(["!disabled"])
        wait_for_run(app, run)

        text = log_text(run)
        assert run.counter.cget("text") == "17 of 17 sales"
        assert float(run.bar.cget("value")) == 100.0
        assert text.count("added, verified") == 17 and text.count("uploaded invoice_") == 17
        assert "Page check passed" in run.status.cget("text")
        assert "DONE. Nothing has been submitted" in text
        assert "Entered:           17 lines" in text
        assert "qty 60" not in text and "Total qty" not in text
        assert "Done. Nothing has been submitted" in run.footer.cget("text")

        # the Review table shows the outcome, the report was written, and test mode kept its own record
        assert app.session.counts()["entered"] == (17, 60)
        assert [v[6] for v in row_values(app)].count("Entered") == 17
        assert run.last_report is not None and run.last_report.is_file()
        assert (paths.data_dir() / "state_test.json").is_file()
        assert not (paths.data_dir() / "state.json").exists()
        assert app.is_unlocked("run")  # still reachable after the run
        # the browser stays open for review; there is nothing left to run
        assert run.browser_open() and run.start_button.instate(["!disabled"])
        run.start_run()
        assert any("no lines ready" in m for _t, m in app.messages)
    finally:
        run.shutdown()
    assert not run.browser_open()


def test_run_page_stop_ends_after_the_current_line(app, invoice_folder):
    run = to_run_page(app, invoice_folder)
    try:
        open_or_skip(app, run)
        run.start_run()
        stopped = []

        def watch():
            if "added, verified" in log_text(run) and not stopped:
                stopped.append(True)
                run.stop_run()
        wait_for_run(app, run, each=watch)
        entered = app.session.counts().get("entered", (0, 0))[0]
        assert stopped and 1 <= entered < 17
        assert "The run was stopped before it finished." in log_text(run)
        assert "Stopping after the current line" in log_text(run)
    finally:
        run.shutdown()


def test_run_page_pause_and_resume(app, invoice_folder):
    run = to_run_page(app, invoice_folder)
    run.limit_var.set("4")
    run._options_changed()
    try:
        open_or_skip(app, run)
        run.start_run()
        state = {"paused": False, "resumed": False}

        def watch():
            if not state["paused"] and "added, verified" in log_text(run):
                state["paused"] = True
                run.toggle_pause()
                assert run.pause_button.cget("text") == "Resume"
                state["at"] = time.time()
            elif state["paused"] and not state["resumed"] and time.time() - state["at"] > 1.0:
                state["resumed"] = True
                run.toggle_pause()
        wait_for_run(app, run, each=watch)
        text = log_text(run)
        assert state["paused"] and state["resumed"]
        assert "Paused after the current line." in text and "Resumed." in text
        assert text.count("added, verified") == 4
    finally:
        run.shutdown()


def test_run_page_limit_for_a_first_trial(app, invoice_folder):
    run = to_run_page(app, invoice_folder)
    run.limit_var.set("2")
    run._options_changed()
    assert len(run.rows_to_run()) == 2
    try:
        open_or_skip(app, run)
        run.start_run()
        wait_for_run(app, run)
        assert run.counter.cget("text") == "2 of 2 sales"
        assert app.session.counts()["entered"][0] == 2
    finally:
        run.shutdown()


def test_run_page_stops_before_entering_when_the_page_check_fails(app, invoice_folder):
    run = to_run_page(app, invoice_folder)
    try:
        open_or_skip(app, run)
        app.session.catalog = replace(app.session.catalog, program="September 2026 Pro Rewards")
        run.start_run()
        wait_for_run(app, run)
        assert "Page check failed" in run.status.cget("text")
        text = log_text(run)
        assert "PROBLEM:" in text and "September 2026 Pro Rewards" in text
        assert "Nothing was entered." in text and "added, verified" not in text
        assert "entered" not in app.session.counts()
    finally:
        run.shutdown()


def test_opening_the_browser_can_fail_politely(app, invoice_folder):
    paths.data_dir().mkdir(parents=True, exist_ok=True)
    default = (paths.defaults_dir() / "config.toml").read_text()
    (paths.data_dir() / "config.toml").write_text(
        default.replace('browser = "auto"', 'browser = "no-such-browser"'))
    run = to_run_page(app, invoice_folder)
    run.open_site()
    assert not run.browser_open()
    assert any("could not be started" in m for _t, m in app.messages)
    assert run.open_button.instate(["!disabled"])


def test_closing_the_app_closes_the_browser_after_asking(app, invoice_folder):
    run = to_run_page(app, invoice_folder)
    open_or_skip(app, run)
    assert run.browser_open()
    app.close()
    assert any(t == "Close Auto Spiffer?" for t, _m in app.messages)
    assert not run.browser_open()


def test_test_mode_and_the_line_limit_are_not_in_the_window(app, invoice_folder):
    from tkinter import ttk
    run = app.pages["run"]
    app.show("run")
    texts = [w.cget("text") for w in run.winfo_children() for w in [w, *w.winfo_children()]
             if isinstance(w, (ttk.Checkbutton, ttk.Spinbox, ttk.Label)) and "text" in w.keys()]
    assert not any("Test mode" in t or "first" in t.lower() for t in texts)
    assert not [w for w in run.winfo_children() if isinstance(w, ttk.Spinbox)]
    assert run.test_var.get() is False and run.limit == 0  # always start off, even if an old file said otherwise


def test_an_old_saved_test_mode_choice_is_ignored(app_home, brands, noise, october):
    from auto_spiffer.settings import Settings
    old = Settings.load()
    old.set("run_test_mode", True)
    old.set("run_limit", 5)
    old.save()
    root, window = make_app(brands, noise)
    try:
        run = window.pages["run"]
        assert run.test_var.get() is False and run.limit == 0
    finally:
        root.destroy()


def test_run_without_invoice_pdfs_enters_sales_only(app):
    load = app.pages["load"]
    load.set_report(str(REPORT))
    load.override_var.set(True)
    load._override_changed()
    load.read_files()  # no invoice PDFs at all
    review = app.pages["review"]
    review.skip_var.set(True)
    review._skip_changed()
    app.browser_headless = True
    run = app.pages["run"]
    run.test_var.set(True)
    run.limit_var.set("3")
    run._options_changed()
    app.show("run")
    assert "No PDFs will be uploaded" in log_text(run)
    try:
        open_or_skip(app, run)
        run.start_run()
        wait_for_run(app, run)
        text = log_text(run)
        assert text.count("added, verified") == 3 and "uploaded invoice_" not in text
        assert "only the sales are entered" in text
        assert "PDFs uploaded:     0" in text
        assert "Remember to upload the invoice PDFs on the website yourself" in run.footer.cget("text")
        assert app.session.counts()["entered"][0] == 3
    finally:
        run.shutdown()


def test_open_button_stays_available_and_notices_a_closed_window(app, invoice_folder):
    run = to_run_page(app, invoice_folder)
    open_or_skip(app, run)
    assert run.open_button.instate(["!disabled"]) and run.start_button.instate(["!disabled"])
    run.browser.call(lambda b: b.page.close())  # the person closes the window
    for _ in range(60):
        run._watch_window()
        if run.browser is None:
            break
        time.sleep(0.2)
    assert run.browser is None and run.start_button.instate(["disabled"])
    assert run.open_button.instate(["!disabled"])
    assert "window was closed" in log_text(run)
    run.open_site()  # Open claim site again, any time
    assert run.browser_open()


def test_clicking_open_again_replaces_the_open_window(app, invoice_folder):
    run = to_run_page(app, invoice_folder)
    open_or_skip(app, run)
    first = run.browser
    run.open_site()
    assert run.browser is not first and run.browser_open() and not first.is_open
