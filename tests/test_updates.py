"""The update check: version comparison and the GitHub lookup (against a local fake server)."""
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from auto_spiffer import updates


@pytest.mark.parametrize("text, expected", [
    ("v0.2.1", (0, 2, 1)), ("0.2.1", (0, 2, 1)), (" v1.10.0 ", (1, 10, 0)),
    ("v1.0.0-rc1", None), ("v1.0", None), ("latest", None), ("", None), (None, None), (5, None),
])
def test_parse_version(text, expected):
    assert updates.parse_version(text) == expected


@pytest.mark.parametrize("latest, current, expected", [
    ("v0.3.0", "0.2.1", True), ("v0.2.2", "0.2.1", True), ("v1.0.0", "0.9.9", True),
    ("v0.10.0", "0.9.0", True),            # numbers, not text: 10 is more than 9
    ("v0.2.1", "0.2.1", False), ("v0.2.0", "0.2.1", False),
    ("v0.3.0", "0.3.0-rc1", True),         # the real release is newer than its own test build
    ("v0.3.0", "0.2.1-rc1", True), ("v0.3.0", "0.3.1-rc1", False), ("v0.3.0", "0.3.0", False),
    ("garbage", "0.2.1", False), ("v0.3.0", "garbage", False), (None, "0.2.1", False),
])
def test_is_newer(latest, current, expected):
    assert updates.is_newer(latest, current) is expected


class FakeGitHub:
    """A local web server that answers like the GitHub releases API."""

    def __init__(self, status=200, body=b"", delay=0.0):
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                outer.requests.append(self.headers.get("User-Agent"))
                time.sleep(delay)
                try:
                    self.send_response(status)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(body)
                except OSError:
                    pass  # the caller gave up waiting

            def log_message(self, *args):
                pass

        self.requests = []
        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_port}/latest"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()


@pytest.fixture
def github():
    made = []

    def make(**kwargs):
        fake = FakeGitHub(**kwargs)
        made.append(fake)
        return fake

    yield make
    for fake in made:
        fake.close()


def release_json(tag="v0.3.0", page="https://github.com/levicavagnetto/auto-spiffer/releases/tag/v0.3.0"):
    return json.dumps({"tag_name": tag, "html_url": page, "name": "Auto Spiffer"}).encode()


def test_latest_release_reads_tag_and_page(github):
    fake = github(body=release_json())
    assert updates.latest_release(fake.url, timeout=3) == (
        "v0.3.0", "https://github.com/levicavagnetto/auto-spiffer/releases/tag/v0.3.0", None)
    assert fake.requests == ["auto-spiffer"]


@pytest.mark.parametrize("status, body", [
    (404, b'{"message": "Not Found"}'),
    (403, b'{"message": "rate limit exceeded"}'),
    (200, b"this is not json"),
    (200, b"[]"),
    (200, b'{"tag_name": "v0.3.0"}'),                                   # no page address
    (200, release_json(tag="nightly")),                                  # not a version
    (200, json.dumps({"tag_name": 3, "html_url": "x"}).encode()),
])
def test_latest_release_is_none_for_bad_replies(github, status, body):
    assert updates.latest_release(github(status=status, body=body).url, timeout=3) is None


def test_latest_release_gives_up_on_a_slow_server(github):
    fake = github(body=release_json(), delay=2.0)
    started = time.monotonic()
    assert updates.latest_release(fake.url, timeout=0.3) is None
    assert time.monotonic() - started < 1.5


def test_latest_release_is_none_when_nothing_is_listening():
    assert updates.latest_release("http://127.0.0.1:9/latest", timeout=1) is None


# ------------------------------------------------- the installer in a release
import hashlib  # noqa: E402

DIGEST = "sha256:" + "ab" * 32


def asset(name="AutoSpiffer-Setup-v0.3.0.exe", url=None, size=1000, digest=DIGEST):
    return {"name": name, "size": size, "digest": digest,
            "browser_download_url": url or f"https://github.com/levicavagnetto/auto-spiffer/releases/download/v0.3.0/{name}"}


def test_latest_release_includes_its_installer(github):
    body = json.dumps({"tag_name": "v0.3.0", "html_url": "https://x/v0.3.0",
                       "assets": [asset("AutoSpiffer-v0.3.0-windows.zip"), asset()]}).encode()
    release = updates.latest_release(github(body=body).url, timeout=3)
    assert release.tag == "v0.3.0" and release.installer == updates.Installer(
        asset()["browser_download_url"], 1000, "ab" * 32)


def test_the_lookup_can_be_pointed_at_a_test_release(github, monkeypatch):
    fake = github(body=release_json(tag="v0.4.0-rc1"))
    monkeypatch.setenv(updates.URL_OVERRIDE, fake.url)
    assert updates.latest_release(timeout=3).tag == "v0.4.0-rc1"


@pytest.mark.parametrize("assets", [
    None, [], "x", [asset("AutoSpiffer-Setup-v0.2.9.exe")],              # missing, or another version's
    [asset(url="http://github.com/AutoSpiffer-Setup-v0.3.0.exe")],      # not https
    [asset(size=0)], [asset(size="1000")],
    [asset(digest=None)], [asset(digest="md5:abc")], [asset(digest="sha256:xyz")],
])
def test_no_installer_unless_it_is_fully_described(assets):
    assert updates.find_installer("v0.3.0", assets) is None


def installer_for(fake, data, name="AutoSpiffer-Setup-v0.3.0.exe", size=None, sha=None):
    return updates.Installer(fake.url.replace("/latest", "/" + name), len(data) if size is None else size,
                             sha or hashlib.sha256(data).hexdigest())


def test_download_checks_the_file_and_reports_progress(github, tmp_path):
    data = bytes(range(256)) * 4000
    fake = github(body=data)
    (tmp_path / "AutoSpiffer-Setup-v0.1.0.exe").write_bytes(b"old")
    seen = []
    path = updates.download_installer(installer_for(fake, data), tmp_path, progress=lambda d, t: seen.append((d, t)))
    assert path == tmp_path / "AutoSpiffer-Setup-v0.3.0.exe" and path.read_bytes() == data
    assert seen[-1] == (len(data), len(data)) and len(seen) > 1
    assert sorted(p.name for p in tmp_path.iterdir()) == ["AutoSpiffer-Setup-v0.3.0.exe"]  # the old one went


@pytest.mark.parametrize("size, sha", [(None, "00" * 32), (10, None), (10 ** 7, None)])
def test_a_download_that_does_not_match_is_thrown_away(github, tmp_path, size, sha):
    data = b"installer" * 1000
    fake = github(body=data)
    with pytest.raises(updates.UpdateError, match="did not match"):
        updates.download_installer(installer_for(fake, data, size=size, sha=sha), tmp_path)
    assert list(tmp_path.iterdir()) == []


def test_download_refuses_an_odd_file_name(tmp_path):
    with pytest.raises(updates.UpdateError, match="file name"):
        updates.download_installer(updates.Installer("https://x/evil.bat", 3, "00" * 32), tmp_path)


def test_download_failure_is_a_plain_message(tmp_path):
    bad = updates.Installer("http://127.0.0.1:9/AutoSpiffer-Setup-v0.3.0.exe", 3, "00" * 32)
    with pytest.raises(updates.UpdateError, match="could not be downloaded"):
        updates.download_installer(bad, tmp_path, timeout=1)


def test_the_installer_runs_silently_and_reopens_the_app(tmp_path):
    path = tmp_path / "AutoSpiffer-Setup-v0.3.0.exe"
    command = updates.installer_command(path)
    assert command[0] == str(path)
    assert {"/SILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/RELAUNCH"} <= set(command)
    assert f"/LOG={tmp_path / 'AutoSpiffer-Setup-v0.3.0.log'}" in command
