"""The state of one working session, with no window code in it.

The window (auto_spiffer/gui) only calls this class. It owns: the chosen report and invoice files,
the tire list, the month's workspace, the matched result, and the person's decisions (resolved
tires, excluded rows, changed quantities). Because it has no GUI code it is tested headless.
"""
from __future__ import annotations

import json
from copy import copy
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Iterable, Optional

from auto_spiffer.brands import BrandTable, load_brands
from auto_spiffer.catalog import Catalog, CatalogError, compact_key, load_catalog
from auto_spiffer.invoices import InvoiceIndex, index_folder, index_paths
from auto_spiffer.models import ClaimRow, CatalogItem
from auto_spiffer.pipeline import (HELD, PrepareResult, ProgramCheck, TO_ENTER, check_program, prepare)
from auto_spiffer.product_map import ProductMap
from auto_spiffer.report_parse import Report, ReportError, parse_report
from auto_spiffer.state import EnteredEntry, State, state_path_for_test_mode
from auto_spiffer.tirespec import NoiseRules, load_noise
from auto_spiffer.workspace import (Workspace, copy_report, list_workspaces, sync_invoices,
                                    workspace_for)

EXCLUDED = "excluded"
MAX_QTY = 999  # the claim page's quantity box holds three digits


def row_key(row: ClaimRow) -> str:
    """A stable identity for a line, so decisions survive re-running the analysis."""
    return f"{row.invoice}|{compact_key(row.description)}"


@dataclass
class Decisions:
    excluded: set[str] = field(default_factory=set)
    qty: dict[str, int] = field(default_factory=dict)
    skip_unresolved: bool = False
    override_program_mismatch: bool = False

    def to_dict(self) -> dict:
        return {"excluded": sorted(self.excluded), "qty": self.qty,
                "skip_unresolved": self.skip_unresolved,
                "override_program_mismatch": self.override_program_mismatch}

    @classmethod
    def from_dict(cls, data: dict) -> "Decisions":
        return cls(set(data.get("excluded", [])), {k: int(v) for k, v in data.get("qty", {}).items()},
                   bool(data.get("skip_unresolved", False)),
                   bool(data.get("override_program_mismatch", False)))


class Session:
    def __init__(self, brands: Optional[BrandTable] = None, noise: Optional[NoiseRules] = None,
                 load_saved: bool = True):
        self._brands, self._noise = brands, noise
        self.allow_missing_pdf = False  # set from Settings by the window
        self.use_pdfs = True            # set from Settings: False means PDFs are not used at all
        self.catalog: Optional[Catalog] = load_catalog() if load_saved else None
        self.product_map = ProductMap.load()
        self.temp_choices = ProductMap(path=self.product_map.path)  # choices not saved for next month
        self.state = State.load()
        self.reset()

    # ------------------------------------------------------------- lifecycle
    def reset(self) -> None:
        """Start a new month: forget the chosen files and the matched result (not the tire list)."""
        self.report_path: Optional[Path] = None
        self.report: Optional[Report] = None
        self.report_error: Optional[str] = None
        self.invoice_paths: list[Path] = []
        self.invoice_preview: Optional[InvoiceIndex] = None
        self.workspace: Optional[Workspace] = None
        self.result: Optional[PrepareResult] = None
        self.decisions = Decisions()
        self.temp_choices.entries.clear()
        self.run_results: dict[str, tuple[str, str]] = {}  # row_key -> ("entered" | "failed", message)
        self._index: Optional[InvoiceIndex] = None

    @property
    def brands(self) -> BrandTable:
        if self._brands is None:
            self._brands = load_brands()
        return self._brands

    @property
    def noise(self) -> NoiseRules:
        if self._noise is None:
            self._noise = load_noise()
        return self._noise

    # ----------------------------------------------------------------- inputs
    def set_report(self, path: str | Path) -> Optional[Report]:
        """Read the chosen report. Returns it, or None with report_error set."""
        self.report_path = Path(path)
        self.report, self.report_error = None, None
        try:
            self.report = parse_report(path)
        except ReportError as exc:
            self.report_error = str(exc)
        return self.report

    def add_invoice_paths(self, chosen: Iterable[str | Path]) -> int:
        """Add PDFs (a folder adds every PDF directly inside it). Returns how many were new."""
        before = len(self.invoice_paths)
        known = {p.resolve() for p in self.invoice_paths}
        for item in (Path(c) for c in chosen):
            files = sorted(item.iterdir(), key=lambda p: p.name.lower()) if item.is_dir() else [item]
            for f in files:
                if f.is_file() and f.suffix.lower() == ".pdf" and f.resolve() not in known:
                    known.add(f.resolve())
                    self.invoice_paths.append(f)
        self.invoice_preview = None
        return len(self.invoice_paths) - before

    def remove_invoice_paths(self, removed: Iterable[Path]) -> None:
        drop = {Path(p).resolve() for p in removed}
        self.invoice_paths = [p for p in self.invoice_paths if p.resolve() not in drop]
        self.invoice_preview = None

    def clear_invoices(self) -> None:
        self.invoice_paths, self.invoice_preview = [], None

    def refresh_invoice_preview(self) -> InvoiceIndex:
        """Read every chosen PDF (slow for many files, so the window runs this in the background)."""
        self.invoice_preview = index_paths(self.invoice_paths)
        return self.invoice_preview

    def preview_missing_invoices(self) -> list[str]:
        """Invoice numbers of the report's tire rows that none of the chosen PDFs covers."""
        if self.report is None or self.invoice_preview is None:
            return []
        have = set(self.invoice_preview.by_invoice)
        return sorted({r.invoice for r in self.report.tire_rows} - have)

    # ------------------------------------------------------------- readiness
    def program_check(self) -> Optional[ProgramCheck]:
        if self.report is None or self.catalog is None:
            return None
        return check_program(self.report, self.catalog)

    def can_read(self) -> tuple[bool, str]:
        if self.report_path is None:
            return False, "Choose the Material Sales report first."
        if self.report is None:
            return False, self.report_error or "The report could not be read."
        if self.catalog is None:
            return False, "Load a tire list (ClaimForm.pdf) first."
        check = self.program_check()
        if check is not None and not check.ok and not self.decisions.override_program_mismatch:
            return False, "The tire list is for a different month than the report."
        return True, ""

    # ----------------------------------------------------------- workspaces
    def read(self) -> PrepareResult:
        """Copy the chosen files into this month's workspace and work out what to enter."""
        ok, reason = self.can_read()
        if not ok:
            raise ReportError(reason)
        ws = workspace_for(self.report)
        copy_report(ws, self.report_path)
        copies = sync_invoices(ws, self.invoice_paths)
        ws.write_meta(report_name=self.report_path.name, program=self.catalog.program,
                      period_start=str(self.report.period_start), period_end=str(self.report.period_end))
        self.workspace = ws
        self.report_path = ws.report_file
        self.invoice_paths = copies
        self._index = index_folder(ws.invoices_dir)
        self._load_decisions(keep_override=True)
        self.save_decisions()
        return self.analyze()

    def open_workspace(self, ws: Workspace) -> PrepareResult:
        """Reopen a month from its saved copies and decisions."""
        report = self.set_report(ws.report_file)
        if report is None:
            raise ReportError(self.report_error or "The saved report could not be read.")
        self.workspace = ws
        self.invoice_paths = sorted(ws.invoices_dir.glob("*.pdf"), key=lambda p: p.name.lower())
        self._index = index_folder(ws.invoices_dir)
        self._load_decisions()
        return self.analyze()

    def recent_workspaces(self) -> list[Workspace]:
        return list_workspaces()

    def _load_decisions(self, keep_override: bool = False) -> None:
        override = self.decisions.override_program_mismatch
        try:
            self.decisions = Decisions.from_dict(
                json.loads(self.workspace.decisions_file.read_text(encoding="utf-8")))
        except (OSError, ValueError):
            self.decisions = Decisions()
        if keep_override and override:
            self.decisions.override_program_mismatch = True

    def save_decisions(self) -> None:
        if self.workspace is not None:
            self.workspace.decisions_file.write_text(
                json.dumps(self.decisions.to_dict(), indent=2), encoding="utf-8")

    # --------------------------------------------------------------- analysis
    @property
    def uses_pdfs(self) -> bool:
        """Invoice PDFs are optional. They are used only when some were loaded and the Settings allow it.

        Otherwise the app enters the sales only, and the person uploads the PDFs on the website.
        """
        return self.use_pdfs and self._index is not None and bool(self._index.pdfs)

    def _combined_map(self) -> ProductMap:
        merged = {**self.product_map.entries, **self.temp_choices.entries}
        return ProductMap(entries=merged, path=self.product_map.path)

    def analyze(self) -> PrepareResult:
        if self.workspace is None or self.report is None or self.catalog is None:
            raise ReportError("Nothing has been read yet.")
        if self.product_map.sync(self.catalog):
            self.product_map.save()
        self.state = State.load()
        self.result = prepare(
            self.report, self.catalog, index=self._index if self.uses_pdfs else None,
            brands=self.brands, noise=self.noise,
            product_map=self._combined_map(), state=self.state,
            ignore_program_mismatch=self.decisions.override_program_mismatch,
            allow_missing_pdf=self.allow_missing_pdf)
        return self.result

    def set_catalog(self, catalog: Catalog) -> None:
        """A new tire list was loaded. Re-matches everything if a month is open."""
        self.catalog = catalog
        if self.workspace is not None and self.report is not None:
            self.analyze()

    # ------------------------------------------------------- rows + decisions
    @property
    def rows(self) -> list[ClaimRow]:
        """The lines to show: the analysis with the person's decisions applied (copies)."""
        if self.result is None or self.result.blocked:
            return []
        rows = []
        for base in self.result.claim_rows:
            row = copy(base)
            row.notes = list(base.notes)
            key = row_key(row)
            if key in self.decisions.qty and self.decisions.qty[key] != row.qty:
                row.notes.append(f"quantity changed from {row.qty} to {self.decisions.qty[key]} by you")
                row.qty = self.decisions.qty[key]
            if key in self.decisions.excluded:
                row.status = EXCLUDED
                row.notes.append("excluded by you")
            elif self.decisions.skip_unresolved and row.status == HELD:
                row.status = EXCLUDED
                row.notes.append("skipped (not resolved)")
            if key in self.run_results and row.status in (TO_ENTER, "entered", "failed"):
                row.status, message = self.run_results[key]
                if message:
                    row.notes.append(message)
            rows.append(row)
        return rows

    def matched_at(self, index: int):
        return self.result.matched[index]

    def counts(self) -> dict[str, tuple[int, int]]:
        """status -> (number of lines, total quantity)."""
        out: dict[str, tuple[int, int]] = {}
        for row in self.rows:
            n, q = out.get(row.status, (0, 0))
            out[row.status] = (n + 1, q + row.qty)
        return out

    def to_enter(self) -> list[ClaimRow]:
        return [r for r in self.rows if r.status == TO_ENTER]

    def runnable(self) -> list[ClaimRow]:
        """Lines a run should work on: the ready ones, plus any that failed last time (to retry)."""
        return [r for r in self.rows if r.status in (TO_ENTER, "failed")]

    def resolve(self, index: int, item: Optional[CatalogItem], remember: bool = True) -> None:
        """The person chose a tire for a line (or None for 'not eligible')."""
        spec = self.matched_at(index).spec
        item_id = item.id if item else None
        if remember:
            self.product_map.remember(spec, item_id)
            self.product_map.save()
            self.temp_choices.forget(spec)
        else:
            self.temp_choices.remember(spec, item_id)
        self.analyze()

    def set_qty(self, index: int, qty: int) -> None:
        if not 1 <= qty <= MAX_QTY:
            raise ValueError(f"The quantity must be between 1 and {MAX_QTY}.")
        key = row_key(self.result.claim_rows[index])
        if qty == self.result.claim_rows[index].qty:
            self.decisions.qty.pop(key, None)
        else:
            self.decisions.qty[key] = qty
        self.save_decisions()

    def exclude(self, index: int) -> None:
        self.decisions.excluded.add(row_key(self.result.claim_rows[index]))
        self.save_decisions()

    def include(self, index: int) -> None:
        self.decisions.excluded.discard(row_key(self.result.claim_rows[index]))
        self.save_decisions()

    def is_excluded(self, index: int) -> bool:
        return row_key(self.result.claim_rows[index]) in self.decisions.excluded

    def set_skip_unresolved(self, value: bool) -> None:
        self.decisions.skip_unresolved = value
        self.save_decisions()

    def set_override_program_mismatch(self, value: bool) -> None:
        self.decisions.override_program_mismatch = value
        self.save_decisions()

    def record_run(self, summary) -> None:
        """Remember what a run did, so the Review table can show Entered and Failed."""
        for row in summary.entered + summary.already_there:
            self.run_results[row_key(row)] = ("entered", "")
        for row, why in summary.failed:
            self.run_results[row_key(row)] = ("failed", "failed: " + why)

    def entered_records(self) -> list[EnteredEntry]:
        """What the app has recorded as entered for the invoices of the open report."""
        if self.report is None:
            return []
        invoices = {r.invoice for r in self.report.rows}
        return [e for e in State.load().entered if e.invoice in invoices]

    def reenter_month(self) -> int:
        """Forget what was recorded as entered and uploaded for this report's invoices, so the lines
        can be entered again. Only for when they were NOT submitted. Returns how many records went."""
        if self.report is None:
            return 0
        invoices = {r.invoice for r in self.report.rows}
        real = State.load()
        removed = sum(real.forget_invoice(i) for i in invoices)
        real.save()
        practice = State.load(state_path_for_test_mode())  # the test-mode record goes too
        for i in invoices:
            practice.forget_invoice(i)
        practice.save()
        self.run_results.clear()
        if self.workspace is not None and self.result is not None:
            self.analyze()
        return removed

    def continue_blockers(self) -> list[str]:
        """Reasons the Run page is not available yet (empty means ready to continue)."""
        if self.result is None:
            return ["Read the files first."]
        if self.result.blocked:
            return [self.result.program_check.message]
        blockers = []
        held = [r for r in self.rows if r.status == HELD]
        if held:
            blockers.append(f"{len(held)} line(s) still need your decision (or skip them).")
        if not self.runnable() and not any(r.status in ("entered", "already_entered") for r in self.rows):
            blockers.append("Nothing is ready to enter.")
        return blockers

    def can_continue(self) -> bool:
        return not self.continue_blockers()

    def result_for_report(self) -> Optional[PrepareResult]:
        """The result with the person's decisions applied, for the CSV and the summary."""
        if self.result is None:
            return None
        return replace(self.result, claim_rows=self.rows)
