"""The browser window the app drives (the person's own Chrome or Edge, through Playwright).

Playwright must be used from the one thread that started it, and the window has to stay open
between "Open claim site" (the person logs in) and "start" (the app takes over). So a single
dedicated thread owns the browser and runs whatever jobs it is given, one at a time.
"""
from __future__ import annotations

import queue
import threading
from concurrent.futures import Future
from pathlib import Path
from typing import Any, Callable, Optional

from auto_spiffer.fill import ClaimPage, FillConfig, FillError
from auto_spiffer.login import Credentials, login_and_navigate
from auto_spiffer.page_stub import install_stub

FIXTURE_PAGE = "ATD ProRewards - Submit Claim.html"


def saved_page_path(configured: str = "") -> Path:
    """The saved copy of the claim page used by test mode."""
    if configured:
        return Path(configured)
    from auto_spiffer import paths
    source_root = Path(__file__).resolve().parent.parent
    for candidate in (paths.data_dir() / FIXTURE_PAGE,
                      paths.app_dir() / "test_page" / FIXTURE_PAGE,
                      paths.app_dir() / "tests" / "fixtures" / FIXTURE_PAGE,
                      source_root / "tests" / "fixtures" / FIXTURE_PAGE):
        if candidate.is_file():
            return candidate
    raise FillError("The saved copy of the claim page for test mode was not found "
                    f"(looked for tests/fixtures/{FIXTURE_PAGE}).")


def installed_browsers() -> list[str]:
    """Which of Chrome and Edge are installed ("chrome", "msedge"), by looking in the usual places."""
    import os
    import shutil

    def exists(*parts: str) -> bool:
        base = [os.environ.get(v, "") for v in parts[0].split("|")]
        return any(b and Path(b, *parts[1:]).is_file() for b in base)

    found = []
    if (exists("ProgramFiles|ProgramFiles(x86)|LocalAppData", "Google", "Chrome", "Application", "chrome.exe")
            or shutil.which("google-chrome") or shutil.which("chrome")):
        found.append("chrome")
    if (exists("ProgramFiles|ProgramFiles(x86)|LocalAppData", "Microsoft", "Edge", "Application", "msedge.exe")
            or shutil.which("microsoft-edge") or shutil.which("msedge")):
        found.append("msedge")
    return found


def browser_problem(preferred: str = "auto") -> Optional[str]:
    """A plain sentence when the browser the app needs is not installed, else None."""
    found = installed_browsers()
    if preferred in ("chrome", "msedge"):
        if preferred in found:
            return None
        name = "Google Chrome" if preferred == "chrome" else "Microsoft Edge"
        return f"{name} was chosen in Settings but is not installed. Install it or pick another browser in Settings."
    if found:
        return None
    return "Neither Google Chrome nor Microsoft Edge was found. Install one of them to use the Run page."


def launch_chromium(playwright, preferred: str, headless: bool):
    channels = ["chrome", "msedge"] if preferred == "auto" else [preferred]
    errors = []
    for channel in channels:
        try:
            return playwright.chromium.launch(channel=channel, headless=headless)
        except Exception as exc:
            errors.append(f"{channel}: {str(exc).splitlines()[0] if str(exc) else exc.__class__.__name__}")
    raise FillError("Google Chrome or Microsoft Edge could not be started. Install one of them and try "
                    "again. (" + "; ".join(errors) + ")")


class BrowserSession:
    """Owns the browser. `call(fn)` runs fn(self) on the browser thread and returns its result."""

    def __init__(self, cfg: FillConfig, *, test_mode: bool = False, headless: bool = False,
                 test_window: Optional[tuple[str, str]] = None, test_page: str = "",
                 credentials: Optional[Credentials] = None, month: str = ""):
        self.cfg = cfg
        self.test_mode = test_mode
        self.headless = headless
        self.test_window = test_window
        self.test_page = test_page
        self.credentials = credentials
        self.month = month
        self.login_note = ""  # what the automatic login did, for the Run log ("" when none was tried)
        self.context = None
        self.page = None
        self._jobs: "queue.Queue[Optional[tuple[Future, Callable]]]" = queue.Queue()
        self._ready = threading.Event()
        self._error: Optional[BaseException] = None
        self._thread: Optional[threading.Thread] = None
        self._closed = False
        self._window_closed = False  # the person closed the browser window themselves

    # --------------------------------------------------------------- lifecycle
    def start(self) -> "BrowserSession":
        self._thread = threading.Thread(target=self._main, name="browser", daemon=True)
        self._thread.start()
        self._ready.wait()
        if self._error is not None:
            raise self._error if isinstance(self._error, FillError) else FillError(
                f"The browser could not be opened: {self._error}")
        return self

    @property
    def is_open(self) -> bool:
        return (self._thread is not None and self._thread.is_alive() and not self._closed
                and not self._window_closed)

    def submit(self, fn: Callable[["BrowserSession"], Any]) -> Future:
        future: Future = Future()
        if not self.is_open:
            future.set_exception(FillError("The browser window is not open. Click 'Open claim site' first."))
            return future
        self._jobs.put((future, fn))
        return future

    def call(self, fn: Callable[["BrowserSession"], Any], timeout: Optional[float] = None) -> Any:
        return self.submit(fn).result(timeout)

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        self._jobs.put(None)
        if self._thread is not None:
            self._thread.join(timeout=10)

    # ---------------------------------------------------------------- the thread
    def _main(self) -> None:
        from playwright.sync_api import sync_playwright
        playwright = browser = None
        try:
            playwright = sync_playwright().start()
            browser = launch_chromium(playwright, self.cfg.browser, self.headless)
            if self.headless:
                self.context = browser.new_context(viewport={"width": 1400, "height": 1000})
            else:
                self.context = browser.new_context(no_viewport=True)
            if self.test_mode:
                # Nothing may reach the real website from test mode. Local files only.
                self.context.route("http*://**", lambda route: route.abort())
            self.page = self.context.new_page()
            if self.test_mode:
                self.page.goto(saved_page_path(self.test_page).resolve().as_uri(), wait_until="load")
                self.page.wait_for_timeout(300)
                install_stub(self.page, self.test_window)
            else:
                self.page.goto(self.cfg.live_url, wait_until="domcontentloaded")
                if self.credentials is not None:
                    self.login_note = login_and_navigate(self.page, self.cfg, self.credentials, self.month).message
        except BaseException as exc:  # reported to whoever called start()
            self._error = exc
            self._ready.set()
            self._shutdown(playwright, browser)
            return
        self._ready.set()

        while True:
            try:
                job = self._jobs.get(timeout=0.5)
            except queue.Empty:
                if self._window_gone():
                    self._window_closed = True
                    break
                continue
            if job is None:
                break
            future, fn = job
            if not future.set_running_or_notify_cancel():
                continue
            try:
                future.set_result(fn(self))
            except BaseException as exc:
                future.set_exception(_friendly(exc))
        self._shutdown(playwright, browser)

    def _window_gone(self) -> bool:
        """True once every browser tab is closed. Runs on the browser thread when it is idle."""
        try:
            self.page.wait_for_timeout(1)  # lets Playwright notice tabs that were closed
            return not any(not p.is_closed() for p in self.context.pages)
        except Exception:
            return True  # the browser itself went away

    @staticmethod
    def _shutdown(playwright, browser) -> None:
        for closer in (getattr(browser, "close", None), getattr(playwright, "stop", None)):
            try:
                if closer:
                    closer()
            except Exception:
                pass

    # ---------------------------------------------------------- helpers for jobs
    def claim_page(self) -> ClaimPage:
        """The tab showing the claim form. Call only from the browser thread."""
        claim = ClaimPage.find(self.context, self.cfg)
        if claim is None:
            raise FillError("The browser is not showing the 'Submit a Sales Claim' page. Log in, go to "
                            "Claims > Submit a Sales Claim for the right program, then try again.")
        return claim


def _friendly(exc: BaseException) -> BaseException:
    if isinstance(exc, FillError):
        return exc
    text = str(exc)
    if "Target page, context or browser has been closed" in text or "has been closed" in text:
        return FillError("The browser window was closed. Click 'Open claim site' to open it again.")
    return exc
