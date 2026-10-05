"""One folder per month, holding that month's copied inputs, decisions, and results.

data/months/2026-09/
    workspace.json     what this month is (period, original file name, when it was made)
    Material-Sales.pdf the copied report
    invoices/          the copied invoice PDFs
    decisions.json     what the person decided (excluded rows, changed quantities, ...)

Everything is a COPY, so the original files are never touched, and a month can be reopened later.
"""
from __future__ import annotations

import hashlib
import json
import shutil
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Iterable, Optional

from auto_spiffer import paths
from auto_spiffer.report_parse import Report

REPORT_NAME = "Material-Sales.pdf"


@dataclass
class Workspace:
    path: Path

    @property
    def month(self) -> str:
        return self.path.name

    @property
    def report_file(self) -> Path:
        return self.path / REPORT_NAME

    @property
    def invoices_dir(self) -> Path:
        return self.path / "invoices"

    @property
    def decisions_file(self) -> Path:
        return self.path / "decisions.json"

    @property
    def meta_file(self) -> Path:
        return self.path / "workspace.json"

    def ensure(self) -> "Workspace":
        self.invoices_dir.mkdir(parents=True, exist_ok=True)
        return self

    def read_meta(self) -> dict:
        try:
            return json.loads(self.meta_file.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    def write_meta(self, **fields) -> None:
        meta = self.read_meta()
        meta.update(fields)
        meta["updated"] = datetime.now().isoformat(timespec="seconds")
        meta.setdefault("created", meta["updated"])
        self.meta_file.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

    @property
    def label(self) -> str:
        """'September 2026' for 2026-09."""
        try:
            return datetime.strptime(self.month, "%Y-%m").strftime("%B %Y")
        except ValueError:
            return self.month


def month_key(report: Report) -> str:
    """'2026-09' from the report's period (or its first sale date)."""
    day: Optional[date] = report.period_start or (report.rows[0].sale_date if report.rows else None)
    return day.strftime("%Y-%m") if day else datetime.now().strftime("unknown-%Y%m%d-%H%M%S")


def workspace_for(report: Report) -> Workspace:
    return Workspace(paths.months_dir() / month_key(report)).ensure()


def list_workspaces() -> list[Workspace]:
    """Existing months, newest first."""
    root = paths.months_dir()
    if not root.exists():
        return []
    found = [Workspace(p) for p in root.iterdir() if (p / "workspace.json").is_file()]
    return sorted(found, key=lambda w: w.month, reverse=True)


def _hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def copy_report(workspace: Workspace, source: Path) -> None:
    source = Path(source)
    if source.resolve() != workspace.report_file.resolve():
        shutil.copyfile(source, workspace.report_file)


def sync_invoices(workspace: Workspace, sources: Iterable[Path]) -> list[Path]:
    """Make the workspace's invoices folder hold copies of exactly these PDFs.

    A file already there with the same name and the same contents is kept. A different file with
    the same name gets a numbered name instead of overwriting. Copies that are no longer selected
    are removed (they are only copies). Returns the paths of the copies.
    """
    workspace.ensure()
    target = workspace.invoices_dir.resolve()
    wanted: list[Path] = []
    for source in (Path(s) for s in sources):
        source = source.resolve()
        if source.parent == target:  # already a copy in this workspace
            wanted.append(source)
            continue
        dest = target / source.name
        number = 2
        while dest.exists() and _hash(dest) != _hash(source):
            dest = target / f"{source.stem}-{number}{source.suffix}"
            number += 1
        if not dest.exists():
            shutil.copyfile(source, dest)
        wanted.append(dest)
    keep = {p.resolve() for p in wanted}
    for existing in target.iterdir():
        if existing.is_file() and existing.resolve() not in keep:
            existing.unlink()
    return sorted(wanted, key=lambda p: p.name.lower())
