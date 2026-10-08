"""Find out whether a newer release of the app exists on GitHub.

Everything here is quiet on failure: no internet, a bad reply or a slow server just means "no update".
"""
from __future__ import annotations

import json
import re
import urllib.request
from typing import Optional

LATEST_URL = "https://api.github.com/repos/levicavagnetto/auto-spiffer/releases/latest"
_VERSION = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)$")


def parse_version(text: object) -> Optional[tuple[int, int, int]]:
    """'v0.2.1' or '0.2.1' -> (0, 2, 1). Anything else (including 'v1.0.0-rc1') -> None."""
    if not isinstance(text, str):
        return None
    match = _VERSION.match(text.strip())
    return tuple(int(part) for part in match.groups()) if match else None


def is_newer(latest: object, current: object) -> bool:
    """True only when both versions parse and `latest` is higher than `current`."""
    a, b = parse_version(latest), parse_version(current)
    return a is not None and b is not None and a > b


def latest_release(url: str = LATEST_URL, timeout: float = 5.0) -> Optional[tuple[str, str]]:
    """(tag, page address) of the latest release, or None if it could not be found for any reason."""
    try:
        request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json",
                                                       "User-Agent": "auto-spiffer"})
        with urllib.request.urlopen(request, timeout=timeout) as reply:
            data = json.load(reply)
        tag, page = data["tag_name"], data["html_url"]
        if not isinstance(tag, str) or not isinstance(page, str) or parse_version(tag) is None:
            return None
        return tag, page
    except Exception:
        return None
