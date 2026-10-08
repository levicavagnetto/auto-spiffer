"""The Settings window: website, saved login, invoice PDF rules, and where the data lives."""
from __future__ import annotations

import os
import tkinter as tk
from tkinter import ttk

from auto_spiffer import login, paths
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
        self.top.transient(app.root)
        frame = ttk.Frame(self.top, padding=16)
        frame.pack(fill="both", expand=True)
        ttk.Label(frame, text="Settings", style="Title.TLabel").pack(anchor="w", pady=(0, 6))

        # ---- website: address and browser
        site = self._section(frame, "Website")
        self.url_var = tk.StringVar(value=url)
        ttk.Label(site, text="Address").grid(row=0, column=0, sticky="w", pady=3)
        ttk.Entry(site, textvariable=self.url_var).grid(row=0, column=1, sticky="ew", padx=(10, 0), pady=3)
        self.browser_var = tk.StringVar(value=BROWSER_LABELS.get(browser, BROWSER_LABELS["auto"]))
        ttk.Label(site, text="Browser").grid(row=1, column=0, sticky="w", pady=3)
        ttk.Combobox(site, textvariable=self.browser_var, state="readonly", width=32,
                     values=[BROWSER_LABELS[c] for c in BROWSER_CHOICES]).grid(
            row=1, column=1, sticky="w", padx=(10, 0), pady=3)

        # ---- saved login
        box = self._section(frame, "Saved login")
        self.user_var = tk.StringVar(value=login.saved_username(app.settings))
        self.pass_var = tk.StringVar()
        ttk.Label(box, text="Username").grid(row=0, column=0, sticky="w", pady=3)
        ttk.Entry(box, textvariable=self.user_var).grid(row=0, column=1, sticky="ew", padx=(10, 0), pady=3)
        ttk.Label(box, text="Password").grid(row=1, column=0, sticky="w", pady=3)
        ttk.Entry(box, textvariable=self.pass_var, show="*").grid(row=1, column=1, sticky="ew",
                                                                  padx=(10, 0), pady=3)
        actions = ttk.Frame(box)
        actions.grid(row=2, column=1, sticky="w", padx=(10, 0), pady=(4, 0))
        ttk.Button(actions, text="Save login", command=self.save_login).pack(side="left")
        ttk.Button(actions, text="Forget", command=self.forget_login).pack(side="left", padx=6)
        self.login_status = ttk.Label(actions, style="Subtle.TLabel")
        self.login_status.pack(side="left", padx=(8, 0))
        self.refresh_login_status()

        # ---- invoice PDFs
        pdfs = self._section(frame, "Invoice PDFs")
        self.use_var = tk.BooleanVar(value=not bool(app.settings.get("use_invoice_pdfs")))
        ttk.Checkbutton(pdfs, text="I upload the PDFs myself (ignore any I load)",
                        variable=self.use_var).pack(anchor="w", pady=2)
        self.allow_var = tk.BooleanVar(value=bool(app.settings.get("allow_missing_pdf")))
        ttk.Checkbutton(pdfs, text="Enter sales that have no PDF, even when others do",
                        variable=self.allow_var).pack(anchor="w", pady=2)

        # ---- updates
        updates = self._section(frame, "Updates")
        self.updates_var = tk.BooleanVar(value=bool(app.settings.get("check_updates")))
        ttk.Checkbutton(updates, text="Check for updates when the app starts",
                        variable=self.updates_var).pack(anchor="w", pady=2)

        # ---- files
        files = self._section(frame, "Files")
        files.columnconfigure(0, weight=1)
        ttk.Label(files, text=str(paths.app_dir()), style="Subtle.TLabel", wraplength=420).grid(
            row=0, column=0, sticky="w")
        ttk.Button(files, text="Open folder", command=self.open_folder).grid(row=0, column=1, padx=(10, 0))

        buttons = ttk.Frame(frame)
        buttons.pack(fill="x", pady=(14, 0))
        ttk.Button(buttons, text="Cancel", command=self.close).pack(side="right")
        ttk.Button(buttons, text="Save", command=self.save).pack(side="right", padx=6)

        # Size to the content, then sit near the top-middle of the main window.
        self.top.geometry("600x1")  # a width to lay the content out against, then grow to fit its height
        self.top.update()
        width, height = max(self.top.winfo_reqwidth(), 600), self.top.winfo_reqheight()
        x = app.root.winfo_rootx() + max(0, (app.root.winfo_width() - width) // 2)
        y = app.root.winfo_rooty() + max(0, (app.root.winfo_height() - height) // 3)
        self.top.geometry(f"{width}x{height}+{x}+{y}")
        self.top.minsize(width, height)

    @staticmethod
    def _section(parent, title: str) -> ttk.LabelFrame:
        """A titled group, with its second column stretching so boxes line up and fill the width."""
        group = ttk.LabelFrame(parent, text=f" {title} ", padding=(12, 8))
        group.pack(fill="x", pady=5)
        group.columnconfigure(0, minsize=80)  # the same label width in every group, so boxes line up
        group.columnconfigure(1, weight=1)
        return group

    def refresh_login_status(self) -> None:
        if login.load_credentials(self.app.settings) is not None:
            text = f"Saved: yes ({login.saved_username(self.app.settings)})"
        elif not login.storage_available():
            text = "Saved: unavailable (no Windows Credential Manager)"
        else:
            text = "Saved: no"
        self.login_status.config(text=text)

    def save_login(self) -> None:
        try:
            login.save_credentials(self.app.settings, self.user_var.get(), self.pass_var.get())
        except ValueError as exc:
            self.app.error("Saved login", str(exc))
            return
        self.pass_var.set("")
        self.refresh_login_status()

    def forget_login(self) -> None:
        login.forget_credentials(self.app.settings)
        self.user_var.set("")
        self.pass_var.set("")
        self.refresh_login_status()

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
        self.app.apply_settings(allow_missing_pdf=self.allow_var.get(),
                                use_pdfs=not self.use_var.get(),
                                check_updates=self.updates_var.get())
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
