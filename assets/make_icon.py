"""Rebuild assets/icon.ico and icon.png from assets/icon.svg (needs playwright and pillow).

    python assets/make_icon.py
"""
import io
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
SIZES = [16, 24, 32, 48, 64, 128, 256]


def main() -> None:
    svg = (HERE / "icon.svg").read_text(encoding="utf-8")
    html = f"<html><body style='margin:0;background:transparent'><div style='width:512px;height:512px'>{svg}</div></body></html>"
    html = html.replace('width="800" height="800"', 'width="512" height="512"', 1)
    with sync_playwright() as p:
        browser = None
        for channel in ("chrome", "msedge"):
            try:
                browser = p.chromium.launch(channel=channel)
                break
            except Exception:
                continue
        if browser is None:
            raise SystemExit("Chrome or Edge is needed to draw the icon.")
        page = browser.new_page(viewport={"width": 512, "height": 512})
        page.set_content(html)
        png = page.screenshot(omit_background=True, clip={"x": 0, "y": 0, "width": 512, "height": 512})
        browser.close()
    image = Image.open(io.BytesIO(png)).convert("RGBA")
    image.save(HERE / "icon.png")
    image.save(HERE / "icon.ico", sizes=[(s, s) for s in SIZES])
    print("Wrote icon.png and icon.ico")


if __name__ == "__main__":
    main()
