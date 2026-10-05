"""Dialogs: choosing a tire for a line, and confirming a new tire list."""
from __future__ import annotations

import tkinter as tk
from tkinter import ttk
from typing import Optional

from auto_spiffer.catalog import Catalog, CatalogDiff
from auto_spiffer.gui import theme
from auto_spiffer.models import CatalogItem


class FixDialog:
    """Pick the right ClaimForm tire for a report line (or mark it not eligible), and change its qty."""

    def __init__(self, app, index: int):
        self.app, self.index = app, index
        self.session = app.session
        self.row = self.session.rows[index]
        self.matched = self.session.matched_at(index)
        self.choice: Optional[CatalogItem] = None
        self.closed = False

        self.top = tk.Toplevel(app.root)
        self.top.title("Choose the ClaimForm tire")
        root = app.root
        width, height = 700, 660
        x = root.winfo_rootx() + max(0, (root.winfo_width() - width) // 2)
        y = root.winfo_rooty() + max(0, (root.winfo_height() - height) // 2)
        self.top.geometry(f"{width}x{height}+{x}+{y}")
        self.top.transient(app.root)
        frame = ttk.Frame(self.top, padding=14)
        frame.pack(fill="both", expand=True)

        ttk.Label(frame, text="Report says:", font=(theme.FONT, 9, "bold")).pack(anchor="w")
        tk.Label(frame, text=f"{self.row.description}\ninvoice {self.row.invoice}   qty {self.row.qty}",
                 bg="#f3f3f3", anchor="w", justify="left", padx=8, pady=6, relief="groove",
                 wraplength=640).pack(fill="x", pady=(2, 6))
        reason = self.matched.result.reason
        if reason:
            ttk.Label(frame, text="Why it is not settled: " + reason, style="Subtle.TLabel",
                      wraplength=640).pack(anchor="w", pady=(0, 6))

        ttk.Label(frame, text="Best guesses:", font=(theme.FONT, 9, "bold")).pack(anchor="w")
        self.guesses = self._suggestions()
        self.best_list = tk.Listbox(frame, height=max(3, min(len(self.guesses), 4)), activestyle="none",
                                    exportselection=False)
        for item, score in self.guesses:
            self.best_list.insert("end", f"{item.site_text}   ({score:.0f}% match)")
        if not self.guesses:
            self.best_list.insert("end", "(no close matches on the list)")
        self.best_list.pack(fill="x", pady=(2, 8))
        self.best_list.bind("<<ListboxSelect>>", self._picked_guess)

        search = ttk.Frame(frame)
        search.pack(fill="x")
        ttk.Label(search, text="Or search all tires:").pack(side="left")
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self._fill_all())
        ttk.Entry(search, textvariable=self.search_var, width=34).pack(side="left", padx=6)
        listing = ttk.Frame(frame)
        listing.pack(fill="both", expand=True, pady=(4, 8))
        self.all_list = tk.Listbox(listing, activestyle="none", exportselection=False)
        scroll = ttk.Scrollbar(listing, orient="vertical", command=self.all_list.yview)
        self.all_list.config(yscrollcommand=scroll.set)
        self.all_list.pack(side="left", fill="both", expand=True)
        scroll.pack(side="left", fill="y")
        self.all_list.bind("<<ListboxSelect>>", self._picked_any)
        self.shown: list[CatalogItem] = []
        self._fill_all()

        self.chosen_label = ttk.Label(frame, text="Nothing chosen yet.", style="Subtle.TLabel", wraplength=640)
        self.chosen_label.pack(anchor="w")
        self.remember_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(frame, text="Remember this choice for future months",
                        variable=self.remember_var).pack(anchor="w", pady=(6, 0))
        self.skip_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(frame, text="This is not an eligible tire (skip it)",
                        variable=self.skip_var).pack(anchor="w")
        qty_row = ttk.Frame(frame)
        qty_row.pack(anchor="w", pady=(6, 0))
        ttk.Label(qty_row, text="Quantity:").pack(side="left")
        self.qty_var = tk.StringVar(value=str(self.row.qty))
        ttk.Spinbox(qty_row, from_=1, to=999, width=6, textvariable=self.qty_var).pack(side="left", padx=6)

        buttons = ttk.Frame(frame)
        buttons.pack(fill="x", pady=(12, 0))
        ttk.Button(buttons, text="Cancel", command=self.close).pack(side="right")
        ttk.Button(buttons, text="Use selected tire", command=self.accept).pack(side="right", padx=6)

    # --------------------------------------------------------------- choices
    def _suggestions(self) -> list[tuple[CatalogItem, float]]:
        result = self.matched.result
        out = list(result.candidates)
        if result.item is not None and all(item.id != result.item.id for item, _ in out):
            out.insert(0, (result.item, result.score))
        return out[:4]

    def _fill_all(self) -> None:
        needle = self.search_var.get().strip().lower()
        tires = sorted(self.session.catalog.tires, key=lambda t: t.site_text.lower())
        self.shown = [t for t in tires if needle in t.site_text.lower()]
        self.all_list.delete(0, "end")
        for item in self.shown:
            self.all_list.insert("end", item.site_text)

    def _picked_guess(self, _event=None) -> None:
        picked = self.best_list.curselection()
        if picked and picked[0] < len(self.guesses):
            self.all_list.selection_clear(0, "end")
            self.choose(self.guesses[picked[0]][0])

    def _picked_any(self, _event=None) -> None:
        picked = self.all_list.curselection()
        if picked:
            self.best_list.selection_clear(0, "end")
            self.choose(self.shown[picked[0]])

    def choose(self, item: CatalogItem) -> None:
        self.choice = item
        self.skip_var.set(False)
        self.chosen_label.config(text=f"Chosen: {item.site_text}   (${item.unit_value:.2f} each)")

    # -------------------------------------------------------------- finishing
    def accept(self) -> bool:
        """Apply the choice. Returns False (and shows a message) when the input is not valid."""
        try:
            qty = int(self.qty_var.get())
            if qty != self.row.qty:
                self.session.set_qty(self.index, qty)
        except ValueError as exc:
            self.app.error("Quantity", str(exc) if "between" in str(exc) else "Type the quantity as a whole number.")
            return False
        if self.skip_var.get():
            self.session.resolve(self.index, None, self.remember_var.get())
        elif self.choice is not None:
            self.session.resolve(self.index, self.choice, self.remember_var.get())
        self.app.refresh_all()
        self.close()
        return True

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


class DiffDialog:
    """Shows what changes when a new ClaimForm replaces the current tire list, and asks to confirm."""

    def __init__(self, app, new: Catalog, old: Optional[Catalog], diff: Optional[CatalogDiff],
                 unparsed: list[str], notes: list[str]):
        self.app = app
        self.confirmed = False
        self.top = tk.Toplevel(app.root)
        self.top.title("Update the tire list")
        self.top.geometry("760x600")
        self.top.transient(app.root)
        frame = ttk.Frame(self.top, padding=14)
        frame.pack(fill="both", expand=True)

        start = new.program_start.strftime("%m/%d/%Y") if new.program_start else "?"
        end = new.program_end.strftime("%m/%d/%Y") if new.program_end else "?"
        ttk.Label(frame, text=new.program, style="Title.TLabel").pack(anchor="w")
        ttk.Label(frame, text=f"{start} to {end}   -   {len(new.tires)} tires, {len(new.wheels)} wheels",
                  style="Subtle.TLabel").pack(anchor="w", pady=(0, 8))

        text = tk.Text(frame, wrap="word", height=22, font=("Consolas", 9), relief="groove")
        text.pack(fill="both", expand=True)
        text.insert("end", self.describe(new, old, diff, unparsed, notes))
        text.config(state="disabled")
        for warning in (diff.warnings if diff else []):
            tk.Label(frame, text="⚠  " + warning, fg=theme.BAD, anchor="w", justify="left",
                     wraplength=700).pack(fill="x", pady=(6, 0))

        buttons = ttk.Frame(frame)
        buttons.pack(fill="x", pady=(10, 0))
        ttk.Button(buttons, text="Cancel", command=self.close).pack(side="right")
        label = "Use this list anyway" if unparsed else "Use this tire list"
        ttk.Button(buttons, text=label, command=self.confirm).pack(side="right", padx=6)

    @staticmethod
    def describe(new: Catalog, old: Optional[Catalog], diff: Optional[CatalogDiff],
                 unparsed: list[str], notes: list[str]) -> str:
        lines: list[str] = []
        if old is None or diff is None:
            lines.append("This is the first tire list. Nothing to compare with.")
        elif not diff.has_changes:
            lines.append("No changes. This list is the same as the current one.")
        else:
            def block(title, items):
                if items:
                    lines.append(f"{title}: {len(items)}")
                    lines.extend(f"    {i.site_text}   ${i.unit_value:.2f}" for i in items)
                    lines.append("")
            block("Added (new tires)", diff.added)
            block("Removed (no longer on the list)", diff.removed)
            if diff.value_changed:
                lines.append(f"Value changed: {len(diff.value_changed)}")
                lines.extend(f"    {n.site_text}   ${o.unit_value:.2f} -> ${n.unit_value:.2f}"
                             for o, n in diff.value_changed)
                lines.append("")
            if diff.renamed:
                lines.append(f"Probably renamed: {len(diff.renamed)}")
                lines.extend(f"    {o.site_text}  ->  {n.site_text}" for o, n in diff.renamed)
                lines.append("")
            lines.append(f"Unchanged: {diff.unchanged}")
        if unparsed:
            lines += ["", f"Could not read {len(unparsed)} line(s) of the ClaimForm:"]
            lines.extend(f"    {u}" for u in unparsed)
        lines.extend(f"\nNote: {n}" for n in notes)
        return "\n".join(lines)

    def confirm(self) -> None:
        self.confirmed = True
        self.close()

    def close(self) -> None:
        try:
            self.top.grab_release()
        except tk.TclError:
            pass
        self.top.destroy()

    def show_modal(self) -> bool:
        self.top.grab_set()
        self.app.root.wait_window(self.top)
        return self.confirmed
