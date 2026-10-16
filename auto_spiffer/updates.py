"""Find out whether a newer release of the app exists on GitHub, and install it.

The lookup is quiet on failure: no internet, a bad reply or a slow server just means "no update".
Installing downloads the release's installer, checks it against the size and SHA-256 GitHub lists
for it, and starts it silently. The installer closes the app, installs over it, and opens it again.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import tempfile
import urllib.request
from pathlib import Path
from typing import Callable, NamedTuple, Optional

LATEST_URL = "https://api.github.com/repos/levicavagnetto/auto-spiffer/releases/latest"
# For testing an update before it ships: point the lookup at one release instead, e.g.
#   .../releases/tags/v0.4.0-rc1
URL_OVERRIDE = "AUTO_SPIFFER_UPDATE_URL"
HEADERS = {"Accept": "application/vnd.github+json", "User-Agent": "auto-spiffer"}


class UpdateError(Exception):
    """The update could not be downloaded or started. The message is for the person."""


class Installer(NamedTuple):
    url: str
    size: int
    sha256: str  # lower-case hex


class Release(NamedTuple):
    tag: str
    page: str
    installer: Optional[Installer] = None  # None: no installer we trust, only the page can be opened
_VERSION = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)$")


def parse_version(text: object) -> Optional[tuple[int, int, int]]:
    """'v0.2.1' or '0.2.1' -> (0, 2, 1). Anything else (including 'v1.0.0-rc1') -> None."""
    if not isinstance(text, str):
        return None
    match = _VERSION.match(text.strip())
    return tuple(int(part) for part in match.groups()) if match else None


_ORDER = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.]+)?$")


def _order(text: object) -> Optional[tuple]:
    """A sortable form of a version. A test build like '0.3.0-rc1' sorts just below the real '0.3.0'."""
    match = _ORDER.match(text.strip()) if isinstance(text, str) else None
    if match is None:
        return None
    major, minor, patch, suffix = match.groups()
    return int(major), int(minor), int(patch), 0 if suffix else 1


def is_newer(latest: object, current: object) -> bool:
    """True only when both versions parse and `latest` is higher than `current`."""
    a, b = _order(latest), _order(current)
    return a is not None and b is not None and a > b


def find_installer(tag: str, assets: object) -> Optional[Installer]:
    """The release's AutoSpiffer-Setup-<tag>.exe, if it is listed with an https link, a size and a
    SHA-256. Anything less and the app does not run it."""
    if not isinstance(assets, list):
        return None
    for asset in assets:
        if not isinstance(asset, dict) or asset.get("name") != f"AutoSpiffer-Setup-{tag}.exe":
            continue
        url, size, digest = asset.get("browser_download_url"), asset.get("size"), asset.get("digest")
        if not (isinstance(url, str) and url.startswith("https://")):
            return None
        if not (isinstance(size, int) and size > 0):
            return None
        match = re.fullmatch(r"sha256:([0-9a-fA-F]{64})", digest) if isinstance(digest, str) else None
        if match is None:
            return None
        return Installer(url, size, match.group(1).lower())
    return None


def latest_release(url: Optional[str] = None, timeout: float = 5.0) -> Optional[Release]:
    """The latest release, or None if it could not be found for any reason."""
    try:
        request = urllib.request.Request(url or os.environ.get(URL_OVERRIDE) or LATEST_URL, headers=HEADERS)
        with urllib.request.urlopen(request, timeout=timeout) as reply:
            data = json.load(reply)
        tag, page = data["tag_name"], data["html_url"]
        if not isinstance(tag, str) or not isinstance(page, str) or _order(tag) is None:
            return None
        return Release(tag, page, find_installer(tag, data.get("assets")))
    except Exception:
        return None


def download_folder() -> Path:
    return Path(tempfile.gettempdir()) / "AutoSpiffer-update"


def download_installer(installer: Installer, folder: Optional[Path] = None,
                       progress: Optional[Callable[[int, int], None]] = None,
                       timeout: float = 30.0) -> Path:
    """Download the installer and check it is exactly the file GitHub listed. Returns its path.
    `progress(done, total)` is called as it arrives (from this thread). Raises UpdateError."""
    folder = folder or download_folder()
    name = installer.url.rsplit("/", 1)[-1]
    if not re.fullmatch(r"AutoSpiffer-Setup-[0-9A-Za-z.\-]+\.exe", name):
        raise UpdateError("The update has an unexpected file name, so it was not downloaded.")
    try:
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob("AutoSpiffer-Setup-*"):  # earlier downloads
            old.unlink(missing_ok=True)
        target, part = folder / name, folder / (name + ".part")
        digest, done = hashlib.sha256(), 0
        request = urllib.request.Request(installer.url, headers={"User-Agent": HEADERS["User-Agent"]})
        with urllib.request.urlopen(request, timeout=timeout) as reply, open(part, "wb") as out:
            while chunk := reply.read(256 * 1024):
                done += len(chunk)
                if done > installer.size:
                    break
                digest.update(chunk)
                out.write(chunk)
                if progress:
                    progress(done, installer.size)
    except OSError as exc:
        raise UpdateError(f"The update could not be downloaded ({exc}).") from exc
    if done != installer.size or digest.hexdigest() != installer.sha256:
        part.unlink(missing_ok=True)
        raise UpdateError("The downloaded update did not match the one on GitHub, so it was not installed.")
    part.replace(target)
    return target


def installer_command(path: Path) -> list[str]:
    """Install without questions, showing only a progress window, then open the app again
    (/RELAUNCH is read by the installer script)."""
    return [str(path), "/SILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/CLOSEAPPLICATIONS", "/RELAUNCH",
            f"/LOG={path.with_suffix('.log')}"]


def start_installer(path: Path) -> None:
    """Start the installer on its own, so it keeps going when the app exits."""
    flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    try:
        subprocess.Popen(installer_command(path), creationflags=flags, close_fds=True)
    except OSError as exc:
        raise UpdateError(f"The update could not be started ({exc}).") from exc
