"""Page 3: the entry run. Open the claim site, check the page, enter every sale, upload the PDFs, stop."""
from __future__ import annotations

import logging
import queue
import time
import tkinter as tk
from dataclasses import dataclass, replace
from datetime import datetime
from tkinter import ttk
from typing import Optional

from auto_spiffer import paths
from auto_spiffer.browser import BrowserSession
from auto_spiffer.login import load_credentials
from auto_spiffer.fill import (FillError, Filler, PageCheck, RunControl, RunSummary, check_page,
                               load_config)
from auto_spiffer.gui import theme
from auto_spiffer.models import format_page_date
from auto_spiffer.report import summary_lines, write_report_csv
from auto_spiffer.state import State, state_path_for_test_mode


@dataclass
class RunOutcome:
    check: PageCheck
    summary: Optional[RunSummary]


class RunPage(ttk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, padding=14)
        self.app = app
        self.session = app.session
        self.browser: Optional[BrowserSession] = None
        self.control: Optional[RunControl] = None
        self.future = None
        self.events: "queue.Queue[dict]" = queue.Queue()
        self.running = False
        self.opening = False
        self.after(1000, self._watch_window)
        self.last_report = None

        ttk.Label(self, text="Run", style="Title.TLabel").pack(anchor="w")
        ttk.Label(self, text="Open the claim site, log in, go to “Submit a Sales Claim”, then start.",
                  style="Subtle.TLabel").pack(anchor="w", pady=(0, 8))

        row = ttk.Frame(self)
        row.pack(fill="x")
        self.open_button = ttk.Button(row, text="1  Open claim site", command=self.open_site)
        self.open_button.pack(side="left")
        self.start_button = ttk.Button(row, text="2  I'm on the page, start", command=self.start_run)
        self.start_button.pack(side="left", padx=8)
        self.pause_button = ttk.Button(row, text="Pause", command=self.toggle_pause)
        self.pause_button.pack(side="left")
        self.stop_button = ttk.Button(row, text="Stop", command=self.stop_run)
        self.stop_button.pack(side="left", padx=8)
        self.reenter_button = ttk.Button(row, text="Re-enter this month...", command=self.reenter_month)
        self.reenter_button.pack(side="right")

        # Test mode (the saved page) and "only the first N lines" are not shown in the window. They are
        # switches for the tests and the command line, so they always start off and are never remembered.
        self.test_var = tk.BooleanVar(value=False)
        self.limit_var = tk.StringVar(value="0")

        self.mode_banner = theme.banner(self, "", "info")
        self.status = ttk.Label(self, text="", style="Subtle.TLabel", wraplength=900, justify="left")
        self.status.pack(anchor="w", pady=(8, 0))

        big = ttk.Frame(self)
        big.pack(fill="x", pady=(10, 4))
        self.counter = ttk.Label(big, text="0 of 0 sales", font=(theme.FONT, 20, "bold"))
        self.counter.pack(anchor="w")
        self.bar = ttk.Progressbar(big, maximum=100, value=0)
        self.bar.pack(fill="x", pady=6)
        self.now = ttk.Label(big, text="", foreground=theme.INFO_FG)
        self.now.pack(anchor="w")

        box = ttk.LabelFrame(self, text=" Log ", padding=6)
        box.pack(fill="both", expand=True)
        self.log = tk.Text(box, height=12, font=("Consolas", 9), relief="flat", wrap="none", state="disabled")
        scroll = ttk.Scrollbar(box, orient="vertical", command=self.log.yview)
        self.log.config(yscrollcommand=scroll.set)
        self.log.pack(side="left", fill="both", expand=True)
        scroll.pack(side="left", fill="y")

        self.footer = tk.Label(self, text="Nothing has been submitted. When the run finishes you review the "
                                          "page and submit it yourself.", bg=theme.INFO_BG, fg=theme.INFO_FG,
                               anchor="w", padx=10, pady=6)
        self.footer.pack(fill="x", pady=(8, 0))
        self.refresh()

    # ----------------------------------------------------------------- options
    @property
    def limit(self) -> int:
        try:
            return max(0, int(self.limit_var.get()))
        except ValueError:
            return 0

    def _options_changed(self) -> None:
        self.refresh()

    def rows_to_run(self):
        rows = self.session.runnable()
        return rows[: self.limit] if self.limit else rows

    def _state(self) -> State:
        if self.test_var.get():
            return State.load(state_path_for_test_mode())
        return State.load()

    # -------------------------------------------------------------------- log
    def write(self, message: str) -> None:
        self.log.config(state="normal")
        self.log.insert("end", f"{datetime.now():%H:%M:%S}   {message}\n")
        self.log.see("end")
        self.log.config(state="disabled")

    def clear_log(self) -> None:
        self.log.config(state="normal")
        self.log.delete("1.0", "end")
        self.log.config(state="disabled")

    # ------------------------------------------------------------------ step 1
    def open_site(self) -> None:
        if self.running or self.opening:
            return
        old, self.browser = self.browser, None  # a window that is still open is replaced by a fresh one
        try:
            cfg = load_config()
        except FillError as exc:
            self.app.report_exception(exc, "Could not open the claim site")
            return
        rows = self.session.runnable()
        window = None
        if rows:
            dates = [r.sale_date for r in rows]
            window = (format_page_date(min(dates)), format_page_date(max(dates)))
        test_mode = bool(self.test_var.get())
        workspace = self.session.workspace
        session = BrowserSession(cfg, test_mode=test_mode, headless=self.app.browser_headless,
                                 test_window=window,
                                 credentials=None if test_mode else load_credentials(self.app.settings),
                                 month=workspace.month if workspace is not None else "",
                                 program=self.session.catalog.program if self.session.catalog else "")
        self.status.config(text="Opening the browser...")
        self.opening = True
        self.refresh()

        def start() -> BrowserSession:
            if old is not None:
                old.close()
            return session.start()

        def opened(_value) -> None:
            self.opening = False
            self.browser = session
            self.status.config(text="")
            if session.test_mode:
                self.write("Browser opened on the SAVED page (test mode). Click step 2 to start.")
            elif session.begin_login():
                self.write("Browser opened. Logging in and opening the claim page for you... You can "
                           "take over at any time. Click step 2 once the claim form is showing.")
            else:
                self.write(f"Browser opened at {cfg.live_url}. Log in, go to Claims > Submit a Sales Claim "
                           "for the right program, then click step 2.")
            self.refresh()

        def failed(exc: Exception) -> None:
            self.opening = False
            self.browser = None
            self.refresh()
            self.app.report_exception(exc, "Could not open the claim site")

        self.app.worker.run(start, opened, failed)

    # ------------------------------------------------------------------ step 2
    def start_run(self) -> None:
        if self.running or self.browser is None or not self.browser.is_open:
            return
        rows = self.rows_to_run()
        if not rows:
            self.app.info("Nothing to enter", "There are no lines ready to enter.")
            return
        self.browser.cancel_login()  # the person is taking over: the automatic login must not delay the run
        catalog = self.session.catalog
        state = self._state()
        control = self.control = RunControl()
        test_mode = self.browser.test_mode
        window = (format_page_date(min(r.sale_date for r in rows)), format_page_date(max(r.sale_date for r in rows)))

        clicked = time.monotonic()

        def job(sess: BrowserSession) -> RunOutcome:
            began = time.monotonic()
            claim = sess.claim_page()
            if test_mode:  # test mode pretends the page's program dates are the sales' dates
                claim.page.evaluate("w => { window.__stub.window = w; }", list(window))
            check = check_page(claim.read_info(), rows, catalog)
            done = time.monotonic()
            timing = (f"Ready to enter {done - clicked:.1f}s after start (waited for the browser "
                      f"{began - clicked:.1f}s, checked the page {done - began:.1f}s).")
            logging.info(timing)
            self.events.put({"type": "log", "message": timing})
            self.events.put({"type": "check", "check": check})
            if not check.ok:
                return RunOutcome(check, None)
            filler = Filler(claim, state, control, self.events.put)
            return RunOutcome(check, filler.run(rows))

        self.clear_log()
        self.write(f"Checking the page, then entering {len(rows)} line(s)...")
        self.running = True
        self.counter.config(text=f"0 of {len(rows)} sales")
        self.bar.config(value=0)
        self.future = self.browser.submit(job)
        self.refresh()
        self.app.root.after(100, self.poll)

    def poll(self) -> None:
        """Move what the browser thread reported onto the screen. Runs on the window's thread."""
        try:
            while True:
                self._show(self.events.get_nowait())
        except queue.Empty:
            pass
        if self.future is not None and self.future.done():
            while not self.events.empty():
                self._show(self.events.get_nowait())
            self._finish()
        elif self.running:
            self.app.root.after(100, self.poll)

    def _show(self, event: dict) -> None:
        kind = event["type"]
        if kind == "check":
            check: PageCheck = event["check"]
            for warning in check.warnings:
                self.write("Note: " + warning)
            if check.ok:
                self.status.config(text="✔  Page check passed.", style="Good.TLabel")
            else:
                self.status.config(text="✖  Page check failed. Nothing was entered.", style="Bad.TLabel")
                for problem in check.problems:
                    self.write("PROBLEM: " + problem)
        elif kind == "progress":
            total = max(event["total"], 1)
            self.counter.config(text=f"{event['done']} of {event['total']} sales")
            self.bar.config(value=100 * event["done"] / total)
        elif kind == "now":
            r = event["row"]
            self.now.config(text=f"Now: {r.invoice}  {r.product_text}  x{r.qty}  entering...")
        elif kind == "log":
            self.write(event["message"])

    def _finish(self) -> None:
        future, self.future = self.future, None
        self.running = False
        self.now.config(text="")
        try:
            outcome: RunOutcome = future.result()
        except Exception as exc:
            self.refresh()
            self.app.report_exception(exc, "The run stopped")
            return
        if outcome.summary is None:
            self.write("Nothing was entered.")
        else:
            summary = outcome.summary
            self.session.record_run(summary)
            self.write("")
            for line in summary.lines(show_qty=False):
                self.write(line)
            result = self.session.result_for_report()
            if result is not None:
                result = replace(result, claim_rows=summary.apply_to(self.session.rows))
                folder = paths.output_dir()
                self.last_report = write_report_csv(result, folder)
                self.write(f"Report saved: {self.last_report}")
            self.write("DONE. Nothing has been submitted. Review the page, then submit it yourself.")
            reminder = ""
            if not summary.uploaded and not summary.upload_failed and summary.entered:
                reminder = " Remember to upload the invoice PDFs on the website yourself."
                self.write("No invoice PDFs were uploaded." + reminder)
            self.footer.config(text="Done. Nothing has been submitted. Review the page in the browser, "
                                    "then submit it yourself." + reminder)
        self.app.refresh_all()

    # -------------------------------------------------------------- re-enter
    def reenter_month(self) -> bool:
        """Forget what was recorded as entered, so the lines can be entered again. Asks first."""
        records = self.session.entered_records()
        if self.running or not records:
            return False
        shown = ", ".join(sorted({e.invoice for e in records})[:8])
        more = " ..." if len({e.invoice for e in records}) > 8 else ""
        message = (f"{len(records)} line(s) of this month are recorded as already entered "
                   f"(invoices {shown}{more}).\n\n"
                   "Only go on if you did NOT submit them, or they are gone from the website page. "
                   "Their invoice PDFs will be uploaded again too.\n\n"
                   "Entering sales twice that were already submitted can get a dealer removed from the "
                   "program.\n\n"
                   "Forget these records so they can be entered again?")
        if not self.app.confirm("Re-enter this month", message, warning=True):
            return False
        removed = self.session.reenter_month()
        self.counter.config(text="0 of 0 sales")
        self.write(f"Forgot {removed} record(s). The lines can be entered again.")
        self.footer.config(text="Nothing has been submitted. When the run finishes you review the page and "
                                "submit it yourself.")
        self.app.refresh_all()
        return True

    # ----------------------------------------------------------- pause and stop
    def toggle_pause(self) -> None:
        if not self.running or self.control is None:
            return
        if self.control.paused:
            self.control.resume()
            self.pause_button.config(text="Pause")
            self.write("Resumed.")
        else:
            self.control.pause()
            self.pause_button.config(text="Resume")
            self.write("Paused after the current line.")

    def stop_run(self) -> None:
        if self.running and self.control is not None:
            self.control.stop()
            self.write("Stopping after the current line...")

    # ------------------------------------------------------------------ closing
    def browser_open(self) -> bool:
        return self.browser is not None and self.browser.is_open

    def shutdown(self) -> None:
        """Called when the app closes: stop a run, then close the browser."""
        if self.running and self.control is not None:
            self.control.stop()
            if self.future is not None:
                try:
                    self.future.result(timeout=20)
                except Exception:
                    pass
        if self.browser is not None:
            self.browser.close()
            self.browser = None

    # ------------------------------------------------------------------ display
    def on_show(self) -> None:
        self.refresh()

    def _watch_window(self) -> None:
        """Every second: report how the automatic login went, and notice when the person closes the
        browser window, so step 1 and step 2 reflect it."""
        note = self.browser.login_note() if self.browser is not None else None
        if note:
            self.write(note)
        if self.browser is not None and not self.browser.is_open and not self.opening and not self.running:
            self.browser = None
            self.status.config(text="")
            self.write("The browser window was closed. Click step 1 to open it again.")
            self.refresh()
        try:
            self.after(1000, self._watch_window)
        except tk.TclError:
            pass

    def refresh(self) -> None:
        busy = self.running
        open_ = self.browser_open()
        self.open_button.state(["!disabled"] if not busy and not self.opening else ["disabled"])
        self.start_button.state(["!disabled"] if open_ and not busy else ["disabled"])
        self.pause_button.state(["!disabled"] if busy else ["disabled"])
        self.stop_button.state(["!disabled"] if busy else ["disabled"])
        self.reenter_button.state(["!disabled"] if not busy and self.session.entered_records() else ["disabled"])
        if not busy:
            self.pause_button.config(text="Pause")
        self.mode_banner.pack_forget()
        self.mode_banner.config(text="")
        if self.test_var.get():
            self.mode_banner.config(text="TEST MODE: the saved page is used. Nothing is sent to the real website "
                                         "and nothing is really entered.")
            self.mode_banner.pack(fill="x", pady=(8, 0), before=self.status)
        if not busy and self.future is None and self.counter.cget("text") in ("", "0 of 0 sales"):
            rows = self.rows_to_run()
            self.counter.config(text=f"0 of {len(rows)} sales")
        if not busy and not self.log.get("1.0", "end").strip():
            self._write_plan()

    def _write_plan(self) -> None:
        result = self.session.result_for_report()
        if result is None or result.blocked:
            return
        rows = self.rows_to_run()
        pdfs = sum(1 for r in rows if r.pdf_path)
        self.write(f"Ready to enter: {len(rows)} line(s), {pdfs} invoice PDF(s)."
                   + ("" if pdfs else " No PDFs will be uploaded."))
        for line in summary_lines(result, show_qty=False):
            if line.strip():
                self.write(line)
