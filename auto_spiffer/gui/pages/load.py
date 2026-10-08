"""Page 1: load this month's files (the tire list, the report, and the invoice PDFs)."""
from __future__ import annotations

import tkinter as tk
from pathlib import Path
from tkinter import filedialog, ttk

from auto_spiffer.gui import theme
from auto_spiffer.models import format_page_date


class LoadPage(ttk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, padding=14)
        self.app = app
        self.session = app.session
        self._reading = False

        # ---- title row
        head = ttk.Frame(self)
        head.pack(fill="x")
        ttk.Label(head, text="Load files", style="Title.TLabel").pack(side="left")
        self.recent_button = ttk.Menubutton(head, text="Open recent")
        self.recent_menu = tk.Menu(self.recent_button, tearoff=False, postcommand=self._fill_recent)
        self.recent_button.config(menu=self.recent_menu)
        self.recent_button.pack(side="right")
        ttk.Button(head, text="New month", command=self.new_month).pack(side="right", padx=6)
        ttk.Label(self, text="Load this month's ClaimForm, then the Material Sales report. The invoice PDFs are optional.",
                  style="Subtle.TLabel").pack(anchor="w", pady=(0, 8))

        # ---- warning banner (only shown when something needs attention)
        self.banner_holder = ttk.Frame(self)
        self.banner_holder.pack(fill="x")
        self.banner = theme.banner(self.banner_holder, "")
        self.override_var = tk.BooleanVar(value=False)
        self.override_box = ttk.Checkbutton(
            self.banner_holder, variable=self.override_var, command=self._override_changed,
            text="Continue anyway (only for trying things out: the website rejects dates outside its program)")

        # ---- 1. tire list
        g3 = ttk.LabelFrame(self, text=" 1.  Tire list (ClaimForm.pdf) ", padding=10)
        g3.pack(fill="x", pady=4)
        self.tire_text = ttk.Label(g3, text="")
        self.tire_text.pack(side="left")
        ttk.Button(g3, text="Load ClaimForm.pdf...", command=self.load_tire_list).pack(side="right")

        # ---- 2. report
        g1 = ttk.LabelFrame(self, text=" 2.  Material Sales report ", padding=10)
        g1.pack(fill="x", pady=4)
        self.report_var = tk.StringVar()
        ttk.Entry(g1, textvariable=self.report_var, state="readonly").pack(side="left", fill="x", expand=True)
        ttk.Button(g1, text="Browse...", command=self.choose_report).pack(side="left", padx=(8, 0))
        self.report_status = ttk.Label(g1, text="")
        self.report_status.pack(side="left", padx=(12, 0))

        # ---- 3. invoices
        g2 = ttk.LabelFrame(self, text=" 3.  Invoice PDFs (optional) ", padding=10)
        g2.pack(fill="both", expand=True, pady=4)
        top = ttk.Frame(g2)
        top.pack(fill="both", expand=True)
        self.invoice_list = tk.Listbox(top, height=5, activestyle="none", selectmode="extended")
        self.invoice_list.pack(side="left", fill="both", expand=True)
        scroll = ttk.Scrollbar(top, orient="vertical", command=self.invoice_list.yview)
        self.invoice_list.config(yscrollcommand=scroll.set)
        scroll.pack(side="left", fill="y")
        buttons = ttk.Frame(top)
        buttons.pack(side="left", padx=(10, 0), anchor="n")
        for text, command in (("Add folder...", self.add_folder), ("Add files...", self.add_files),
                              ("Remove selected", self.remove_selected), ("Clear", self.clear_invoices)):
            ttk.Button(buttons, text=text, command=command).pack(fill="x", pady=1)
        self.invoice_status = ttk.Label(g2, text="")
        self.invoice_status.pack(anchor="w", pady=(6, 0))

        # ---- footer
        foot = ttk.Frame(self)
        foot.pack(fill="x", pady=(10, 0))
        self.read_button = ttk.Button(foot, text="Read files and continue  ▶", command=self.read_files)
        self.read_button.pack(side="right")
        self.reason = ttk.Label(foot, text="", style="Subtle.TLabel")
        self.reason.pack(side="left")

    # ---------------------------------------------------------------- actions
    def choose_report(self) -> None:
        path = filedialog.askopenfilename(
            title="Choose the Material Sales report", filetypes=[("PDF files", "*.pdf")],
            initialdir=self.app.settings.get("last_report_dir") or None)
        if path:
            self.set_report(path)

    def set_report(self, path: str) -> None:
        self.app.settings.set("last_report_dir", str(Path(path).parent))
        self.report_var.set(path)
        self.report_status.config(text="Reading...", style="Subtle.TLabel")
        self.app.worker.run(lambda: self.session.set_report(path), lambda _r: self.app.refresh_all(),
                            lambda exc: self.app.report_exception(exc, "Could not read the report"))

    def add_folder(self) -> None:
        folder = filedialog.askdirectory(title="Choose the folder with the invoice PDFs",
                                         initialdir=self.app.settings.get("last_invoice_dir") or None)
        if folder:
            self.add_paths([folder])

    def add_files(self) -> None:
        files = filedialog.askopenfilenames(title="Choose invoice PDFs", filetypes=[("PDF files", "*.pdf")],
                                            initialdir=self.app.settings.get("last_invoice_dir") or None)
        if files:
            self.add_paths(list(files))

    def add_paths(self, chosen) -> None:
        chosen = [Path(c) for c in chosen]
        self.app.settings.set("last_invoice_dir", str(chosen[0] if chosen[0].is_dir() else chosen[0].parent))
        self.session.add_invoice_paths(chosen)
        self._check_invoices()

    def remove_selected(self) -> None:
        picked = [self.session.invoice_paths[i] for i in self.invoice_list.curselection()]
        self.session.remove_invoice_paths(picked)
        self._check_invoices()

    def clear_invoices(self) -> None:
        self.session.clear_invoices()
        self.app.refresh_all()

    def _check_invoices(self) -> None:
        self.app.refresh_all()  # shows "Checking PDFs..." while the background read runs
        self.app.worker.run(self.session.refresh_invoice_preview, lambda _r: self.app.refresh_all(),
                            lambda exc: self.app.report_exception(exc, "Could not read the invoice PDFs"))

    def load_tire_list(self) -> None:
        self.app.pages["tires"].choose_and_update()

    def new_month(self) -> None:
        self.session.reset()
        self.report_var.set("")
        self.override_var.set(False)
        self.app.refresh_all()
        self.app.show("load")

    def _fill_recent(self) -> None:
        self.recent_menu.delete(0, "end")
        workspaces = self.session.recent_workspaces()
        if not workspaces:
            self.recent_menu.add_command(label="(no earlier months yet)", state="disabled")
        for ws in workspaces:
            self.recent_menu.add_command(label=f"{ws.label}   ({ws.month})",
                                         command=lambda w=ws: self.app.open_workspace(w))

    def _override_changed(self) -> None:
        self.session.decisions.override_program_mismatch = self.override_var.get()
        self.session.save_decisions()
        self.refresh()

    def read_files(self) -> None:
        ok, _reason = self.session.can_read()
        if not ok or self._reading:
            return
        self._reading = True
        self.reason.config(text="Reading and matching...")
        self.read_button.state(["disabled"])

        def done(_result) -> None:
            self._reading = False
            self.app.refresh_all()
            if self.app.is_unlocked("review"):
                self.app.show("review")

        def failed(exc: Exception) -> None:
            self._reading = False
            self.app.refresh_all()
            self.app.report_exception(exc, "Could not read the files")

        self.app.worker.run(self.session.read, done, failed)

    # ---------------------------------------------------------------- display
    def on_show(self) -> None:
        self.refresh()

    def refresh(self) -> None:
        s = self.session
        self._refresh_banner()
        self._refresh_report()
        self._refresh_invoices()
        cat = s.catalog
        if cat is None:
            self.tire_text.config(text="No tire list loaded yet.")
        else:
            start = format_page_date(cat.program_start) if cat.program_start else "?"
            end = format_page_date(cat.program_end) if cat.program_end else "?"
            self.tire_text.config(
                text=f"Loaded: {cat.program}  ({start} to {end}),  {len(cat.items)} items,  "
                     f"imported {cat.imported_on:%m/%d/%Y}")
        ok, reason = s.can_read()
        if not self._reading:
            self.read_button.state(["!disabled"] if ok else ["disabled"])
            # No report chosen yet is obvious from the empty box above, so no text for it.
            self.reason.config(text="" if ok or s.report_path is None else reason)
        self.override_var.set(s.decisions.override_program_mismatch)

    def _refresh_banner(self) -> None:
        s = self.session
        check = s.program_check()
        message = ""
        if s.catalog is None:
            message = "⚠  No tire list is loaded. Use \"Load ClaimForm.pdf...\" below."
        elif check is not None and not check.ok:
            message = "⚠  " + check.message
        for widget in (self.banner, self.override_box):
            widget.pack_forget()
        if message:
            self.banner.config(text=message)
            self.banner.pack(fill="x", pady=(0, 4))
            if check is not None and not check.ok:
                self.override_box.pack(anchor="w", pady=(0, 6))

    def _refresh_report(self) -> None:
        s = self.session
        if s.report_path is not None and not self.report_var.get():
            self.report_var.set(str(s.report_path))
        if s.report_path is None:
            self.report_var.set("")
            self.report_status.config(text="", style="Subtle.TLabel")
        elif s.report is not None:
            r = s.report
            self.report_status.config(
                text=f"✔  {len(r.rows)} rows read ({len(r.tire_rows)} tires, {len(r.ignored_rows)} ignored)",
                style="Good.TLabel")
        elif s.report_error:
            self.report_status.config(text="✖  " + s.report_error, style="Bad.TLabel")

    def _refresh_invoices(self) -> None:
        s = self.session
        index = s.invoice_preview
        numbers = {}
        if index is not None:
            numbers = {p.path.resolve(): n for n, group in index.by_invoice.items() for p in group}
        self.invoice_list.delete(0, "end")
        for path in s.invoice_paths:
            number = numbers.get(path.resolve())
            self.invoice_list.insert("end", f"{number or '?':<8}  {path.name}")
        if not s.invoice_paths:
            self.invoice_status.config(
                text="Optional. With none chosen, the app enters the sales only and you upload the "
                     "invoice PDFs yourself on the website.", style="Subtle.TLabel")
        elif index is None:
            self.invoice_status.config(text="Checking PDFs...", style="Subtle.TLabel")
        else:
            parts = [f"✔  {len(index.pdfs)} PDFs for {len(index.by_invoice)} invoice numbers"]
            missing = s.preview_missing_invoices()
            if index.problems:
                parts.append(f"✖  {len(index.problems)} could not be read")
            if missing:
                shown = ", ".join(missing[:6]) + ("..." if len(missing) > 6 else "")
                parts.append(f"⚠  {len(missing)} report invoices have no PDF ({shown})")
            self.invoice_status.config(text="     ".join(parts),
                                       style="Bad.TLabel" if index.problems else "Good.TLabel")
