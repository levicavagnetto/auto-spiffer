"""Page 4: the tire list (ClaimForm), and updating it when a new one comes out."""
from __future__ import annotations

import csv
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, ttk
from typing import Optional

from auto_spiffer.catalog import (Catalog, CatalogError, diff_catalogs, list_history, load_catalog,
                                  save_catalog)
from auto_spiffer.catalog_import import ImportResult, parse_claimform
from auto_spiffer.gui import theme
from auto_spiffer.gui.dialogs import DiffDialog
from auto_spiffer.models import format_page_date


class TiresPage(ttk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, padding=14)
        self.app = app
        self.session = app.session
        self.viewing: Optional[Catalog] = None  # an archived list shown read-only, or None for the current one

        ttk.Label(self, text="Tire list", style="Title.TLabel").pack(anchor="w")
        ttk.Label(self, text="The tires that earn a reward this month.",
                  style="Subtle.TLabel").pack(anchor="w", pady=(0, 8))

        self.header = ttk.Label(self, text="")
        self.header.pack(anchor="w")
        top = ttk.Frame(self)
        top.pack(fill="x", pady=(6, 0))
        self.history_button = ttk.Menubutton(top, text="History")
        self.history_menu = tk.Menu(self.history_button, tearoff=False, postcommand=self._fill_history)
        self.history_button.config(menu=self.history_menu)
        self.history_button.pack(side="right")
        ttk.Button(top, text="Export CSV", command=self.export_csv).pack(side="right", padx=6)
        ttk.Button(top, text="Update from ClaimForm.pdf...", width=30, command=self.choose_and_update).pack(side="right")

        self.banner_area = ttk.Frame(self)
        self.banner_area.pack(fill="x")
        self.view_banner = theme.banner(self.banner_area, "")
        self.back_button = ttk.Button(self.banner_area, text="Back to the current list",
                                      command=self.show_current)

        search = ttk.Frame(self)
        search.pack(fill="x", pady=8)
        ttk.Label(search, text="Search:").pack(side="left")
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self.refresh())
        ttk.Entry(search, textvariable=self.search_var, width=30).pack(side="left", padx=6)
        self.count_label = ttk.Label(search, text="", style="Subtle.TLabel")
        self.count_label.pack(side="left", padx=10)

        holder = ttk.Frame(self)
        holder.pack(fill="both", expand=True)
        self.tree = ttk.Treeview(holder, columns=("tire", "value", "kind"), show="headings")
        for key, text, width, anchor in (("tire", "Tire", 620, "w"),
                                         ("value", "Value", 80, "center"), ("kind", "Kind", 80, "center")):
            self.tree.heading(key, text=text)
            self.tree.column(key, width=width, anchor=anchor, stretch=key == "tire")
        scroll = ttk.Scrollbar(holder, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.pack(side="left", fill="both", expand=True)
        scroll.pack(side="left", fill="y")

    # ------------------------------------------------------------------ display
    def shown_catalog(self) -> Optional[Catalog]:
        return self.viewing or self.session.catalog

    def on_show(self) -> None:
        self.refresh()

    def refresh(self) -> None:
        cat = self.shown_catalog()
        self.tree.delete(*self.tree.get_children())
        self.view_banner.pack_forget()
        self.back_button.pack_forget()
        if cat is None:
            self.header.config(text="No tire list has been loaded yet. Use \"Update from ClaimForm.pdf...\".")
            self.count_label.config(text="")
            return
        start = format_page_date(cat.program_start) if cat.program_start else "?"
        end = format_page_date(cat.program_end) if cat.program_end else "?"
        self.header.config(text=f"{cat.program}   ({start} to {end})   {len(cat.tires)} tires, "
                                f"{len(cat.wheels)} wheels   imported {cat.imported_on:%m/%d/%Y}")
        if self.viewing is not None:
            self.view_banner.config(text="Viewing an earlier list (read only). It is not the list used for matching.")
            self.view_banner.pack(fill="x", pady=(6, 0))
            self.back_button.pack(anchor="w", pady=4)
        needle = self.search_var.get().strip().lower()
        shown = [i for i in cat.items if needle in i.site_text.lower()]
        for item in shown:
            self.tree.insert("", "end", values=(item.site_text, f"${item.unit_value:.2f}", item.kind))
        self.count_label.config(text=f"{len(shown)} of {len(cat.items)} shown")

    # ------------------------------------------------------------------- update
    def choose_and_update(self) -> None:
        path = filedialog.askopenfilename(
            title="Choose the ClaimForm.pdf", filetypes=[("PDF files", "*.pdf")],
            initialdir=self.app.settings.get("last_claimform_dir") or None)
        if path:
            self.begin_update(path)

    def begin_update(self, path: str) -> None:
        self.app.settings.set("last_claimform_dir", str(Path(path).parent))
        self.app.worker.run(lambda: parse_claimform(path), self._review_import,
                            lambda exc: self.app.report_exception(exc, "Could not read the ClaimForm"))

    def _review_import(self, result: ImportResult) -> None:
        old = self.session.catalog
        diff = diff_catalogs(old, result.catalog) if old is not None else None
        notes = [f"New brand '{b}' is not in brands.toml yet." for b in result.new_brands] + result.warnings
        if self.app.synchronous:  # no window to ask: the test calls apply_update itself
            self.pending = (result, diff)
            return
        dialog = DiffDialog(self.app, result.catalog, old, diff, result.unparsed, notes)
        if dialog.show_modal():
            self.apply_update(result.catalog)

    def apply_update(self, catalog: Catalog) -> None:
        """Save the new list (the old one is archived) and re-match everything with it."""
        try:
            archived = save_catalog(catalog)
            self.session.set_catalog(catalog)
        except (CatalogError, OSError) as exc:
            self.app.report_exception(exc, "Could not save the tire list")
            return
        self.viewing = None
        self.app.refresh_all()
        message = f"The tire list is now {catalog.program} ({len(catalog.items)} items)."
        if archived:
            message += "\nThe previous list was kept in the history."
        self.app.info("Tire list updated", message)

    # ------------------------------------------------------------------ history
    def _fill_history(self) -> None:
        self.history_menu.delete(0, "end")
        files = list_history()
        if not files:
            self.history_menu.add_command(label="(no earlier lists yet)", state="disabled")
        for path in reversed(files):
            self.history_menu.add_command(label=path.stem.replace("catalog_", ""),
                                          command=lambda p=path: self.view_history(p))

    def view_history(self, path: Path) -> None:
        try:
            self.viewing = load_catalog(path)
        except CatalogError as exc:
            self.app.report_exception(exc, "Could not open that list")
            return
        self.refresh()

    def show_current(self) -> None:
        self.viewing = None
        self.refresh()

    # ------------------------------------------------------------------- export
    def export_csv(self) -> None:
        cat = self.shown_catalog()
        if cat is None:
            return
        path = filedialog.asksaveasfilename(title="Save the tire list", defaultextension=".csv",
                                            initialfile="tire_list.csv", filetypes=[("CSV files (Excel)", "*.csv")])
        if path:
            self.save_csv(path, cat)

    def save_csv(self, path: str, cat: Optional[Catalog] = None) -> Path:
        cat = cat or self.shown_catalog()
        with open(path, "w", newline="", encoding="utf-8-sig") as handle:
            writer = csv.writer(handle)
            writer.writerow(["Tire", "Value", "Kind", "Brand", "Model", "Category"])
            for i in cat.items:
                writer.writerow([i.site_text, f"{i.unit_value:.2f}", i.kind, i.brand, i.model, i.category])
        self.app.info("Tire list saved", f"Saved to:\n{path}")
        return Path(path)
