"""Build AutoSpiffer.exe (a folder with the program, ready to copy to another computer).

    python build_exe.py

Result: dist/AutoSpiffer/AutoSpiffer.exe  (keep the whole folder together).
Then check it:  dist\\AutoSpiffer\\AutoSpiffer.exe --selftest-browser   (result in dist\\AutoSpiffer\\output\\selftest.txt)
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist" / "AutoSpiffer"
SAVED_PAGE = "ATD ProRewards - Submit Claim.html"


def build() -> int:
    import PyInstaller.__main__ as pyinstaller

    separator = ";" if sys.platform.startswith("win") else ":"
    pyinstaller.run([
        str(ROOT / "run_app.py"),
        "--name", "AutoSpiffer",
        "--noconfirm", "--clean",
        "--windowed",          # no console window
        "--onedir",
        "--distpath", str(ROOT / "dist"),
        "--workpath", str(ROOT / "build"),
        "--specpath", str(ROOT / "build"),
        "--add-data", f"{ROOT / 'auto_spiffer' / 'defaults'}{separator}auto_spiffer/defaults",
        "--collect-all", "playwright",     # includes the browser helper (node) that Playwright needs
        "--collect-all", "pdfminer",       # PDF reading needs its character-map data files
        "--collect-all", "pypdfium2",
        "--collect-submodules", "auto_spiffer",
    ])

    # Things that live next to the program, not inside it.
    fixtures = ROOT / "tests" / "fixtures"
    target = DIST / "test_page"
    target.mkdir(parents=True, exist_ok=True)
    shutil.copy2(fixtures / SAVED_PAGE, target / SAVED_PAGE)
    assets = fixtures / "ATD ProRewards - Submit Claim_files"
    if assets.is_dir():
        shutil.copytree(assets, target / assets.name, dirs_exist_ok=True)
    for name in ("README.md",):
        if (ROOT / name).is_file():
            shutil.copy2(ROOT / name, DIST / name)
    print(f"\nBuilt: {DIST / 'AutoSpiffer.exe'}")
    return 0


if __name__ == "__main__":
    sys.exit(build())
