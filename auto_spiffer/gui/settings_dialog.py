"""The Settings window: site address, browser, missing-PDF rule, test mode, and where the data lives."""
from __future__ import annotations

import os
import tkinter as tk
from tkinter import ttk

from auto_spiffer import paths
from auto_spiffer.fill import BROWSER_CHOICES, FillError, load_config, update_config
from auto_spiffer.gui import theme

BROWSER_LABELS = {"auto": "Automatic (Chrome, then Edge)", "chrome": "Google Chrome", "msedge": "Microsoft Edge"}


class SettingsDialog:
    def __init__(self, app):
        self.app = app
        self.closed = False
        try:
            cfg = load_config()
            url, browser = cfg.live_url, cfg.browser
        except FillError as exc:
            url, browser = "", "auto"
            app.report_exception(exc, "Settings")

        self.top = tk.Toplevel(app.root)
        self.top.title("Settings")
        width, height = 660, 470
        x = app.root.winfo_rootx() + max(0, (app.root.winfo_width() - width) // 2)
        y = app.root.winfo_rooty() + max(0, (app.root.winfo_height() - height) // 3)
        self.top.geometry(f"{width}x{height}+{x}+{y}")
        self.top.transient(app.root)
        frame = ttk.Frame(self.top, padding=16)
        frame.pack(fill="both", expand=True)
        ttk.Label(frame, text="Settings", style="Title.TLabel").pack(anchor="w", pady=(0, 10))

        ttk.Label(frame, text="Claim website address").pack(anchor="w")
        self.url_var = tk.StringVar(value=url)
        ttk.Entry(frame, textvariable=self.url_var).pack(fill="x", pady=(2, 10))

        ttk.Label(frame, text="Browser to use").pack(anchor="w")
        self.browser_var = tk.StringVar(value=BROWSER_LABELS.get(browser, BROWSER_LABELS["auto"]))
        ttk.Combobox(frame, textvariable=self.browser_var, state="readonly",
                     values=[BROWSER_LABELS[c] for c in BROWSER_CHOICES]).pack(anchor="w", pady=(2, 10))

        self.use_var = tk.BooleanVar(value=not bool(app.settings.get("use_invoice_pdfs")))
        ttk.Checkbutton(frame, text="I upload the invoice PDFs myself on the website "
                                    "(ignore any PDFs I load)", variable=self.use_var).pack(anchor="w")
        self.allow_var = tk.BooleanVar(value=bool(app.settings.get("allow_missing_pdf")))
        ttk.Checkbutton(frame, text="When some PDFs are loaded, still enter sales that have none "
                                    "(otherwise they are held back)",
                        variable=self.allow_var).pack(anchor="w", pady=(6, 0))
        self.test_var = tk.BooleanVar(value=bool(app.settings.get("run_test_mode")))
        ttk.Checkbutton(frame, text="Test mode: use the saved page, nothing reaches the real website",
                        variable=self.test_var).pack(anchor="w", pady=(6, 10))

        ttk.Label(frame, text="Where the app keeps its files").pack(anchor="w")
        row = ttk.Frame(frame)
        row.pack(fill="x", pady=(2, 0))
        ttk.Label(row, text=str(paths.app_dir()), style="Subtle.TLabel", wraplength=470).pack(side="left")
        ttk.Button(row, text="Open folder", command=self.open_folder).pack(side="right")
        ttk.Label(frame, text="Month folders, the tire list, saved choices, and the log are in here.",
                  style="Subtle.TLabel").pack(anchor="w", pady=(2, 0))

        buttons = ttk.Frame(frame)
        buttons.pack(side="bottom", fill="x", pady=(14, 0))
        ttk.Button(buttons, text="Cancel", command=self.close).pack(side="right")
        ttk.Button(buttons, text="Save", command=self.save).pack(side="right", padx=6)

    def browser_value(self) -> str:
        label = self.browser_var.get()
        return next((key for key, text in BROWSER_LABELS.items() if text == label), "auto")

    def save(self) -> bool:
        """Write the choices. Returns False (after showing a message) when something is not valid."""
        try:
            update_config(live_url=self.url_var.get(), browser=self.browser_value())
        except FillError as exc:
            self.app.error("Settings", str(exc))
            return False
        self.app.apply_settings(allow_missing_pdf=self.allow_var.get(), test_mode=self.test_var.get(),
                                use_pdfs=not self.use_var.get())
        self.close()
        return True

    def open_folder(self) -> None:
        try:
            os.startfile(str(paths.app_dir()))  # Windows only; elsewhere there is nothing to do
        except (AttributeError, OSError):
            self.app.info("Folder", str(paths.app_dir()))

    def show_modal(self) -> None:
        self.top.grab_set()
        self.app.root.wait_window(self.top)

    def close(self) -> None:
        if not self.closed:
            self.closed = True
            try:
                self.top.grab_release()
            except tk.TclError:
                pass
            self.top.destroy()
