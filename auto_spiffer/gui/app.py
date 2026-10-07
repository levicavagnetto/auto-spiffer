"""The main window: a dark sidebar on the left and one page at a time on the right."""
from __future__ import annotations

import logging
import tkinter as tk
from tkinter import messagebox, ttk
from typing import Optional

from auto_spiffer import __version__, paths
from auto_spiffer.catalog import CatalogError
from auto_spiffer.browser import browser_problem
from auto_spiffer.fill import FillError, load_config
from auto_spiffer.gui import theme
from auto_spiffer.gui.pages.load import LoadPage
from auto_spiffer.gui.pages.review import ReviewPage
from auto_spiffer.gui.pages.run import RunPage
from auto_spiffer.gui.pages.tires import TiresPage
from auto_spiffer.gui.settings_dialog import SettingsDialog
from auto_spiffer.gui.worker import Worker
from auto_spiffer.invoices import InvoiceError
from auto_spiffer.models import format_page_date
from auto_spiffer.report_parse import ReportError
from auto_spiffer.session import Session
from auto_spiffer.settings import Settings
from auto_spiffer.workspace import Workspace

log = logging.getLogger("auto_spiffer")

NAV = (("load", "1   Load files"), ("review", "2   Review"), ("run", "3   Run"), ("tires", "Tire list"))
PLAIN_ERRORS = (ReportError, CatalogError, InvoiceError, FillError, ValueError, OSError)


class App:
    def __init__(self, root: tk.Tk, session: Optional[Session] = None, settings: Optional[Settings] = None,
                 synchronous: bool = False, restore: bool = True, first_run_checks: bool = True):
        self.root = root
        self.synchronous = synchronous
        self.settings = settings or Settings.load()
        self.session = session or Session()
        self.worker = Worker(root, synchronous)
        self.messages: list[tuple[str, str]] = []  # in test mode, dialogs are recorded here instead
        self.current = "load"
        self.browser_headless = False  # tests set this so no browser window appears
        self.confirm_answer = True     # in test mode, what a Yes/No question is answered with
        self.browser_problem = None
        self.session.allow_missing_pdf = bool(self.settings.get("allow_missing_pdf"))
        self.session.use_pdfs = bool(self.settings.get("use_invoice_pdfs"))

        theme.apply_theme(root)
        root.title("Auto Spiffer")
        theme.set_window_icon(root)
        root.geometry(self.settings.get("window_geometry"))
        root.minsize(1100, 640)
        self._build_sidebar()
        self._build_pages()
        root.protocol("WM_DELETE_WINDOW", self.close)
        root.report_callback_exception = self._unexpected_error
        self.show("load")
        self.refresh_all()
        if first_run_checks:
            self._first_run_checks()
        if restore:
            self._restore_last_workspace()

    # ------------------------------------------------------------- building
    def _build_sidebar(self) -> None:
        side = tk.Frame(self.root, bg=theme.SIDEBAR_BG, width=190)
        side.pack(side="left", fill="y")
        side.pack_propagate(False)
        title = tk.Frame(side, bg=theme.SIDEBAR_BG)
        title.pack(fill="x", padx=14, pady=14)
        self.logo = theme.load_image("icon_sidebar.png")  # kept on self so Tk does not drop it
        if self.logo is not None:
            tk.Label(title, image=self.logo, bg=theme.SIDEBAR_BG).pack(side="left", padx=(0, 8))
        tk.Label(title, text="Auto Spiffer", bg=theme.SIDEBAR_BG, fg=theme.SIDEBAR_TEXT,
                 font=(theme.FONT, 15, "bold")).pack(side="left")
        self.month_label = tk.Label(side, text="", bg=theme.SIDEBAR_BG, fg=theme.SIDEBAR_MUTED,
                                    anchor="w", padx=14)
        self.month_label.pack(fill="x")
        self.tire_status = tk.Label(side, text="", bg=theme.SIDEBAR_BG, fg=theme.SIDEBAR_MUTED,
                                    anchor="w", padx=14, wraplength=170, justify="left",
                                    font=(theme.FONT, 8))
        self.tire_status.pack(fill="x", pady=(2, 10))

        self.nav: dict[str, tk.Label] = {}
        for key, text in NAV:
            label = tk.Label(side, text=text, bg=theme.SIDEBAR_BG, fg=theme.SIDEBAR_TEXT, anchor="w",
                             padx=18, pady=10, font=(theme.FONT, 11), cursor="hand2")
            label.pack(fill="x")
            label.bind("<Button-1>", lambda _e, k=key: self.show(k))
            self.nav[key] = label
        self.hint = tk.Label(side, text="", bg=theme.SIDEBAR_BG, fg="#f2c94c", anchor="w", padx=14,
                             wraplength=170, justify="left", font=(theme.FONT, 8))
        self.hint.pack(fill="x", pady=(8, 0))

        tk.Label(side, bg=theme.SIDEBAR_BG).pack(expand=True, fill="both")
        self.workspace_label = tk.Label(side, text="", bg=theme.SIDEBAR_BG, fg=theme.SIDEBAR_MUTED,
                                        anchor="w", padx=14, font=(theme.FONT, 8))
        self.workspace_label.pack(fill="x")
        link = tk.Label(side, text="Settings", bg=theme.SIDEBAR_BG, fg=theme.SIDEBAR_TEXT, anchor="w",
                        padx=18, pady=8, font=(theme.FONT, 10), cursor="hand2")
        link.pack(fill="x")
        link.bind("<Button-1>", lambda _e: self.open_settings())
        tk.Label(side, text=f"version {__version__}", bg=theme.SIDEBAR_BG, fg=theme.SIDEBAR_MUTED,
                 anchor="w", padx=18, font=(theme.FONT, 8)).pack(fill="x", pady=(0, 8))

    def _build_pages(self) -> None:
        self.main = ttk.Frame(self.root)
        self.main.pack(side="left", fill="both", expand=True)
        self.main.grid_rowconfigure(0, weight=1)
        self.main.grid_columnconfigure(0, weight=1)
        self.pages = {
            "load": LoadPage(self.main, self),
            "review": ReviewPage(self.main, self),
            "run": RunPage(self.main, self),
            "tires": TiresPage(self.main, self),
        }
        for page in self.pages.values():
            page.grid(row=0, column=0, sticky="nsew")

    # ----------------------------------------------------------- navigation
    def is_unlocked(self, key: str) -> bool:
        s = self.session
        if key == "review":
            return s.result is not None and not s.result.blocked
        if key == "run":
            return s.can_continue()
        return True

    def lock_reason(self, key: str) -> str:
        if key == "review":
            return "Load and read the files first (page 1)."
        if key == "run":
            blockers = self.session.continue_blockers()
            return blockers[0] if blockers else ""
        return ""

    def show(self, key: str) -> bool:
        if not self.is_unlocked(key):
            self.hint.config(text=self.lock_reason(key))
            return False
        self.hint.config(text="")
        self.current = key
        self.pages[key].tkraise()
        self.pages[key].on_show()
        self._style_nav()
        return True

    def _style_nav(self) -> None:
        for key, label in self.nav.items():
            unlocked = self.is_unlocked(key)
            label.config(bg=theme.SIDEBAR_ACTIVE if key == self.current else theme.SIDEBAR_BG,
                         fg=theme.SIDEBAR_TEXT if unlocked else theme.SIDEBAR_MUTED,
                         cursor="hand2" if unlocked else "arrow")

    # -------------------------------------------------------------- refresh
    def refresh_all(self) -> None:
        s = self.session
        if s.workspace is not None:
            self.month_label.config(text=s.workspace.label)
            self.workspace_label.config(text=f"Workspace: {s.workspace.month}")
        else:
            self.month_label.config(text="No month loaded")
            self.workspace_label.config(text="")
        self.tire_status.config(text=self._tire_status_text(), fg=self._tire_status_color())
        for page in self.pages.values():
            page.refresh()
        self._style_nav()
        if self.current in ("review", "run") and not self.is_unlocked(self.current):
            self.show("load")

    def _tire_status_text(self) -> str:
        cat = self.session.catalog
        if cat is None:
            return "No tire list loaded"
        check = self.session.program_check()
        mark = "" if check is None or check.ok else "   (different month!)"
        return f"Tire list: {cat.program}{mark}"

    def _tire_status_color(self) -> str:
        check = self.session.program_check()
        if self.session.catalog is None or (check is not None and not check.ok):
            return "#f2994a"
        return theme.SIDEBAR_MUTED

    # ------------------------------------------------------------- messages
    def info(self, title: str, message: str) -> None:
        if self.synchronous:
            self.messages.append((title, message))
        else:
            messagebox.showinfo(title, message, parent=self.root)

    def error(self, title: str, message: str) -> None:
        if self.synchronous:
            self.messages.append((title, message))
        else:
            messagebox.showerror(title, message, parent=self.root)

    def confirm(self, title: str, message: str, warning: bool = False) -> bool:
        if self.synchronous:
            self.messages.append((title, message))
            return self.confirm_answer
        if warning:
            return messagebox.askyesno(title, message, parent=self.root, icon="warning", default="no")
        return messagebox.askyesno(title, message, parent=self.root)

    def report_exception(self, exc: Exception, doing: str = "That did not work") -> None:
        """Show a plain message. The details go to the log file, never in front of the person."""
        if isinstance(exc, PLAIN_ERRORS):
            self.error(doing, str(exc))
        else:
            log.exception("Unexpected error while: %s", doing, exc_info=exc)
            self.error(doing, "Something unexpected went wrong. Nothing was changed. "
                              f"Details were written to the log file in {paths.output_dir()}.")

    # --------------------------------------------------------------- startup
    def _restore_last_workspace(self) -> None:
        name = self.settings.get("last_workspace")
        if not name:
            return
        ws = Workspace(paths.months_dir() / name)
        if not ws.meta_file.is_file() or self.session.catalog is None:
            return
        self.open_workspace(ws, quiet=True)

    def open_workspace(self, ws: Workspace, quiet: bool = False) -> None:
        def done(_result) -> None:
            self.refresh_all()
            if self.is_unlocked("review"):
                self.show("review")

        def failed(exc: Exception) -> None:
            if not quiet:
                self.report_exception(exc, "Could not open that month")

        self.worker.run(lambda: self.session.open_workspace(ws), done, failed)

    # ------------------------------------------------------------- settings
    def open_settings(self) -> SettingsDialog:
        dialog = SettingsDialog(self)
        if not self.synchronous:
            dialog.show_modal()
        return dialog

    def apply_settings(self, allow_missing_pdf: bool, test_mode: bool, use_pdfs: bool = True) -> None:
        """Take the Settings window's choices into effect now."""
        self.settings.set("use_invoice_pdfs", bool(use_pdfs))
        self.session.use_pdfs = bool(use_pdfs)
        self.settings.set("allow_missing_pdf", bool(allow_missing_pdf))
        self.settings.set("run_test_mode", bool(test_mode))
        self.settings.save()
        self.session.allow_missing_pdf = bool(allow_missing_pdf)
        self.pages["run"].test_var.set(bool(test_mode))
        self.pages["run"]._options_changed()
        if self.session.workspace is not None and self.session.result is not None:
            try:
                self.session.analyze()
            except Exception as exc:
                self.report_exception(exc, "Could not apply the settings")
        self.refresh_all()

    # ---------------------------------------------------------- first run, errors
    def _first_run_checks(self) -> None:
        """Tell the person early, in plain words, if the Run page cannot work on this computer."""
        try:
            preferred = load_config().browser
        except FillError:
            preferred = "auto"
        problem = browser_problem(preferred)
        self.browser_problem = problem
        if problem:
            self.info("A browser is needed",
                      problem + " Loading files, matching, and the tire list still work without it.")

    def _unexpected_error(self, exc_type, exc, _traceback) -> None:
        """Anything that slips through a button press: a plain message, the details in the log file."""
        log.error("Unexpected error in the window", exc_info=(exc_type, exc, _traceback))
        self.report_exception(exc if isinstance(exc, Exception) else RuntimeError(str(exc)))

    def close(self) -> None:
        run = self.pages["run"]
        if run.running:
            if not self.confirm("A run is in progress",
                                "Auto Spiffer is entering sales right now. If you close it, it stops after "
                                "the current line and the browser closes. Close anyway?"):
                return
        elif run.browser_open():
            if not self.confirm("Close Auto Spiffer?",
                                "The browser window opened by Auto Spiffer will close too. "
                                "Have you finished reviewing and submitting the claim?"):
                return
        run.shutdown()
        if self.root.state() == "normal":  # a minimized or hidden window reports a meaningless size
            width, height = self.root.winfo_width(), self.root.winfo_height()
            if width >= 800 and height >= 500:
                self.settings.set("window_geometry", f"{width}x{height}")
        if self.session.workspace is not None:
            self.settings.set("last_workspace", self.session.workspace.month)
        self.settings.save()
        self.root.destroy()


def run() -> int:
    """Open the window (used by `python -m auto_spiffer gui`)."""
    paths.ensure_dirs()
    logging.basicConfig(filename=str(paths.output_dir() / "auto_spiffer.log"), level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    root = tk.Tk()
    App(root)
    root.mainloop()
    return 0
