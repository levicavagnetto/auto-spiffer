"""A built-in health check, mainly for the packaged .exe (which has no console to print into).

    AutoSpiffer.exe --selftest            checks the pieces the app is made of
    AutoSpiffer.exe --selftest-browser    ...and also opens the saved claim page in a hidden browser

The result is written to output/selftest.txt next to the .exe, and the exit code is 0 only if
everything passed.
"""
from __future__ import annotations

import tempfile
import traceback
from datetime import date
from pathlib import Path
from typing import Callable

from auto_spiffer import __version__, paths


def _check_folders() -> str:
    folders = paths.ensure_dirs()
    probe = folders[0] / ".write_test"
    probe.write_text("ok")
    probe.unlink()
    return f"app folder {paths.app_dir()}"


def _check_defaults() -> str:
    names = ("brands.toml", "noise.toml", "config.toml")
    missing = [n for n in names if not (paths.defaults_dir() / n).is_file()]
    if missing:
        raise RuntimeError("missing default files: " + ", ".join(missing))
    from auto_spiffer.brands import load_brands
    from auto_spiffer.fill import load_config
    from auto_spiffer.tirespec import load_noise
    return f"{len(load_brands().codes)} brand codes, {len(load_noise().words)} noise words, " \
           f"site {load_config().live_url}"


def _check_pdf_reading() -> str:
    from auto_spiffer.demo_pdfs import make_invoice_pdf
    from auto_spiffer.invoices import read_invoice
    with tempfile.TemporaryDirectory() as folder:
        pdf = make_invoice_pdf(Path(folder) / "t.pdf", "214341", date(2026, 9, 5), "GEN 235/50R18 97H")
        info = read_invoice(pdf)
    if info.invoice != "214341" or str(info.invoice_date) != "2026-09-05":
        raise RuntimeError(f"read the wrong thing: {info.invoice} {info.invoice_date}")
    return "read a PDF and found its invoice number and date"


def _check_matching() -> str:
    from rapidfuzz import fuzz
    from auto_spiffer.brands import load_brands
    from auto_spiffer.tirespec import load_noise, parse_tire
    spec = parse_tire("235/50R18 97H GEN AltiMAX RT45 65K 235/50R18 BW 97H (65K)", load_brands(), load_noise())
    if spec.brand is None or spec.brand.name != "General" or spec.words != ["AltiMAX", "RT45"]:
        raise RuntimeError(f"parsed a tire wrongly: {spec.brand} {spec.words}")
    if fuzz.ratio("altimax", "altimax") != 100:
        raise RuntimeError("fuzzy matching is not working")
    return "parsed a tire description"


def _check_window_toolkit() -> str:
    import tkinter as tk
    root = tk.Tk()
    root.withdraw()
    version = root.tk.call("info", "patchlevel")
    root.destroy()
    return f"Tk {version}"


def _check_browser_driver() -> str:
    from playwright._impl._driver import compute_driver_executable
    node, cli = compute_driver_executable()
    for part in (node, cli):
        if not Path(part).exists():
            raise RuntimeError(f"the browser helper is missing: {part}")
    return "browser helper present"


def _check_browsers_installed() -> str:
    from auto_spiffer.browser import installed_browsers
    found = installed_browsers()
    if not found:
        raise RuntimeError("neither Chrome nor Edge was found")
    return "found: " + ", ".join(found)


def _check_saved_page_in_browser() -> str:
    from auto_spiffer.browser import BrowserSession
    from auto_spiffer.fill import load_config
    session = BrowserSession(load_config(), test_mode=True, headless=True).start()
    try:
        info = session.call(lambda s: s.claim_page().read_info())
    finally:
        session.close()
    return f"opened the saved claim page: {len(info.options)} products in the list"


BASIC: list[tuple[str, Callable[[], str]]] = [
    ("folders", _check_folders),
    ("default files", _check_defaults),
    ("reading PDFs", _check_pdf_reading),
    ("matching tires", _check_matching),
    ("window toolkit", _check_window_toolkit),
    ("browser helper", _check_browser_driver),
    ("browser installed", _check_browsers_installed),
]
BROWSER = [("saved page in a browser", _check_saved_page_in_browser)]


def run(argv: list[str]) -> int:
    checks = list(BASIC) + (BROWSER if "--selftest-browser" in argv else [])
    lines = [f"Auto Spiffer {__version__} self-check"]
    failed = 0
    for name, check in checks:
        try:
            lines.append(f"OK    {name}: {check()}")
        except Exception as exc:
            failed += 1
            lines.append(f"FAIL  {name}: {exc.__class__.__name__}: {exc}")
            lines.append(traceback.format_exc(limit=3).rstrip())
    lines.append("ALL PASSED" if not failed else f"{failed} CHECK(S) FAILED")
    paths.output_dir().mkdir(parents=True, exist_ok=True)
    (paths.output_dir() / "selftest.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return 1 if failed else 0
