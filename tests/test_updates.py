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
        "v0.3.0", "https://github.com/levicavagnetto/auto-spiffer/releases/tag/v0.3.0")
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
