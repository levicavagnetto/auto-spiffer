"""Where the app keeps its files.

Run from source: next to the project (the folder that contains the `auto_spiffer` package).
Run as an .exe:  next to the .exe.
Set AUTO_SPIFFER_HOME to override (used by the tests).
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path


def app_dir() -> Path:
    override = os.environ.get("AUTO_SPIFFER_HOME")
    if override:
        return Path(override)
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def data_dir() -> Path:
    return app_dir() / "data"


def history_dir() -> Path:
    return data_dir() / "history"


def months_dir() -> Path:
    return data_dir() / "months"


def output_dir() -> Path:
    return app_dir() / "output"


def defaults_dir() -> Path:
    """Starting copies of the editable data files that ship with the app."""
    return Path(__file__).resolve().parent / "defaults"


def ensure_data_file(name: str) -> Path:
    """Path of an editable data file in the data folder, copied from the defaults on first use."""
    target = data_dir() / name
    if not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(defaults_dir() / name, target)
    return target


def ensure_dirs() -> list[Path]:
    """Create every folder the app writes to. Returns them in a fixed order."""
    folders = [data_dir(), history_dir(), months_dir(), output_dir()]
    for folder in folders:
        folder.mkdir(parents=True, exist_ok=True)
    return folders
