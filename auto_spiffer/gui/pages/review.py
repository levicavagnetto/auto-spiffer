"""Page 2: review what was matched, fix what needs a decision, then continue."""
from __future__ import annotations

import tkinter as tk
from pathlib import Path
from tkinter import filedialog, ttk

from auto_spiffer.gui import theme
from auto_spiffer.gui.dialogs import FixDialog
from auto_spiffer.models import format_page_date
from auto_spiffer.report import write_report_to

CARDS = (("ready", "Ready"), ("attention", "Needs attention"), ("not_eligible", "Not eligible"),
         ("problem", "Problem"))


class ReviewPage(ttk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, padding=14)
        self.app = app
        self.session = app.session
        self.filter: str | None = None

        ttk.Label(self, text="Review", style="Title.TLabel").pack(anchor="w")
        ttk.Label(self, text="Check the matches. Amber rows need one decision from you before anything "
                             "is typed. Click a card to filter.", style="Subtle.TLabel").pack(anchor="w", pady=(0, 8))

        # ---- count cards
        cards = ttk.Frame(self)
        cards.pack(fill="x", pady=(0, 10))
        self.cards: dict[str, tuple[tk.Frame, tk.Label, tk.Label]] = {}
        for status, caption in CARDS:
            self._make_card(cards, status, caption, theme.CARD_COLORS[status])

        # ---- table
        holder = ttk.Frame(self)
        holder.pack(fill="both", expand=True)
        columns = ("date", "inv", "desc", "tire", "qty", "pdf", "status")
        self.tree = ttk.Treeview(holder, columns=columns, show="headings", selectmode="browse")
        for key, text, width, anchor in (
                ("date", "Date", 92, "center"), ("inv", "Invoice #", 74, "center"),
                ("desc", "Report description", 280, "w"), ("tire", "Matched ClaimForm tire", 330, "w"),
                ("qty", "Qty", 46, "center"), ("pdf", "PDF", 64, "center"), ("status", "Status", 110, "center")):
            self.tree.heading(key, text=text)
            self.tree.column(key, width=width, anchor=anchor, stretch=key in ("desc", "tire"))
        theme.style_rows(self.tree)
        scroll = ttk.Scrollbar(holder, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.pack(side="left", fill="both", expand=True)
        scroll.pack(side="left", fill="y")
        self.tree.bind("<Double-1>", lambda _e: self.fix_selected())
        self.tree.bind("<Return>", lambda _e: self.fix_selected())
        self.tree.bind("<<TreeviewSelect>>", lambda _e: self._update_buttons())

        self.note = ttk.Label(self, text="", style="Subtle.TLabel")
        self.note.pack(anchor="w", pady=(4, 0))

        # ---- footer
        foot = ttk.Frame(self)
        foot.pack(fill="x", pady=(8, 0))
        self.summary = ttk.Label(foot, text="", font=(theme.FONT, 9, "bold"))
        self.summary.pack(side="left")
        self.continue_button = ttk.Button(foot, text="Continue to Run  ▶", command=self.go_run)
        self.continue_button.pack(side="right")
        self.skip_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(foot, text="Skip rows I have not resolved", variable=self.skip_var,
                        command=self._skip_changed).pack(side="right", padx=10)
        ttk.Button(foot, text="Export CSV", command=self.export_csv).pack(side="right", padx=6)
        self.exclude_button = ttk.Button(foot, text="Exclude row", command=self.toggle_exclude)
        self.exclude_button.pack(side="right")
        self.fix_button = ttk.Button(foot, text="Fix selected...", command=self.fix_selected)
        self.fix_button.pack(side="right", padx=6)
        self.why = ttk.Label(self, text="", foreground=theme.BAD)
        self.why.pack(anchor="e", pady=(4, 0))

    # ------------------------------------------------------------------ cards
    def _make_card(self, parent, key: str, caption: str, color: str) -> None:
        card = tk.Frame(parent, bg="white", highlightbackground="#d0d0d0", highlightthickness=1,
                        padx=16, pady=8, cursor="hand2")
        number = tk.Label(card, text="0", bg="white", fg=color, font=(theme.FONT, 22, "bold"))
        number.pack(anchor="w")
        label = tk.Label(card, text=caption, bg="white", fg=theme.SUBTLE)
        label.pack(anchor="w")
        card.pack(side="left", padx=(0, 10))
        for widget in (card, number, label):
            widget.bind("<Button-1>", lambda _e, k=key: self.set_filter(k))
        self.cards[key] = (card, number, label)

    def set_filter(self, status: str | None) -> None:
        self.filter = None if self.filter == status else status
        self.refresh()

    # --------------------------------------------------------------- display
    def on_show(self) -> None:
        self.refresh()

    def refresh(self) -> None:
        s = self.session
        rows = s.rows
        counts = s.counts()
        for status, _caption in CARDS:
            n, _q = counts.get(status, (0, 0))
            card, number, label = self.cards[status]
            number.config(text=str(n))
            highlight = "#3b5873" if self.filter == status else "#d0d0d0"
            card.config(highlightbackground=highlight, highlightthickness=2 if self.filter == status else 1)

        selected = self.tree.selection()
        self.tree.delete(*self.tree.get_children())
        for i, row in enumerate(rows):
            if self.filter and row.status != self.filter:
                continue
            self.tree.insert("", "end", iid=str(i), tags=(row.status,), values=(
                format_page_date(row.sale_date), row.invoice, row.description, self._tire_text(row),
                f"{row.qty}{'*' if row.merged_from > 1 else ''}", self._pdf_text(row),
                theme.STATUS_TEXT.get(row.status, row.status)))
        if selected and self.tree.exists(selected[0]):
            self.tree.selection_set(selected[0])

        merged = sum(1 for r in rows if r.merged_from > 1)
        notes = []
        if merged:
            notes.append(f"*  quantity added up from several report rows ({merged} line(s))")
        already = counts.get("already_entered", (0, 0))[0]
        if already:
            notes.append(f"{already} line(s) are recorded as already entered. To enter them again, use "
                         "'Re-enter this month' on the Run page.")
        self.note.config(text="     ".join(notes))
        names = [("ready", "Ready"), ("attention", "Needs attention"), ("not_eligible", "Not eligible"),
                 ("problem", "Problem"), ("already_entered", "Already entered"), ("excluded", "Excluded"),
                 ("entered", "Entered"), ("failed", "Failed")]
        self.summary.config(text="    ".join(f"{label} {counts[k][0]}" for k, label in names if k in counts))
        self.skip_var.set(s.decisions.skip_unresolved)
        self._update_buttons()

    @staticmethod
    def _tire_text(row) -> str:
        if row.status == "attention":
            return "(choose a tire...)"
        if row.status == "not_eligible":
            return "(not on the ClaimForm)"
        return row.product_text or "-"

    def _pdf_text(self, row) -> str:
        if not self.session.uses_pdfs:
            return "-"  # invoice PDFs are optional and none are in use
        if row.pdf_path:
            return "Yes"
        return "-" if row.status == "not_eligible" else "No PDF"

    def _selected_index(self) -> int | None:
        picked = self.tree.selection()
        return int(picked[0]) if picked else None

    def _update_buttons(self) -> None:
        index = self._selected_index()
        have = index is not None and self.session.result is not None
        self.fix_button.state(["!disabled"] if have else ["disabled"])
        self.exclude_button.state(["!disabled"] if have else ["disabled"])
        excluded = have and self.session.is_excluded(index)
        self.exclude_button.config(text="Include row" if excluded else "Exclude row")
        blockers = self.session.continue_blockers()
        self.continue_button.state(["!disabled"] if not blockers else ["disabled"])
        self.why.config(text=blockers[0] if blockers else "")

    # ---------------------------------------------------------------- actions
    def fix_selected(self) -> None:
        index = self._selected_index()
        if index is None:
            return
        self.open_fix(index)

    def open_fix(self, index: int) -> FixDialog:
        dialog = FixDialog(self.app, index)
        if not self.app.synchronous:
            dialog.show_modal()
        return dialog

    def toggle_exclude(self) -> None:
        index = self._selected_index()
        if index is None:
            return
        if self.session.is_excluded(index):
            self.session.include(index)
        else:
            self.session.exclude(index)
        self.app.refresh_all()

    def _skip_changed(self) -> None:
        self.session.set_skip_unresolved(self.skip_var.get())
        self.app.refresh_all()

    def export_csv(self) -> None:
        month = self.session.workspace.month if self.session.workspace else "month"
        path = filedialog.asksaveasfilename(
            title="Save the report", defaultextension=".csv", initialfile=f"report_{month}.csv",
            filetypes=[("CSV files (Excel)", "*.csv")])
        if path:
            self.save_csv(path)

    def save_csv(self, path: str) -> Path:
        result = self.session.result_for_report()
        written = write_report_to(result, Path(path))
        self.app.info("Report saved", f"Saved to:\n{written}")
        return written

    def go_run(self) -> None:
        self.app.show("run")
