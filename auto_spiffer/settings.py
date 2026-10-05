"""Small remembered preferences (window size, last folders, last month) in data/settings.json."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from auto_spiffer import paths

DEFAULTS: dict[str, Any] = {
    "window_geometry": "1260x720",
    "last_workspace": "",       # month folder name, e.g. "2026-09"
    "last_report_dir": "",
    "last_invoice_dir": "",
    "last_claimform_dir": "",
    "run_test_mode": False,     # the Run page uses the saved page instead of the real website
    "run_limit": 0,             # only the first N lines (0 = all), for a first trial
    "allow_missing_pdf": False,  # treat sales with no invoice PDF as ready anyway
    "use_invoice_pdfs": True,    # False: ignore invoice PDFs entirely (you upload them yourself)
}


class Settings:
    def __init__(self, values: Optional[dict] = None, path: Optional[Path] = None):
        self.values = {**DEFAULTS, **(values or {})}
        self.path = path or (paths.data_dir() / "settings.json")

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "Settings":
        path = Path(path) if path else paths.data_dir() / "settings.json"
        try:
            return cls(json.loads(path.read_text(encoding="utf-8")), path)
        except (OSError, ValueError):
            return cls(path=path)  # missing or damaged: start from the defaults

    def save(self) -> None:
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps(self.values, indent=2), encoding="utf-8")
        except OSError:
            pass  # remembering preferences is a convenience, never worth an error

    def get(self, key: str) -> Any:
        return self.values.get(key, DEFAULTS.get(key))

    def set(self, key: str, value: Any) -> None:
        self.values[key] = value
