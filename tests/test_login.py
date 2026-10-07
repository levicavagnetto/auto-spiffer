"""Saved login: credential storage, program picking, and the login/navigate steps on a fake site."""
import json

import pytest

from auto_spiffer import login
from auto_spiffer.browser import launch_chromium
from auto_spiffer.fill import load_config
from auto_spiffer.settings import Settings


class FakeKeyring:
    def __init__(self):
        self.items = {}

    def set_password(self, service, user, password):
        self.items[(service, user)] = password

    def get_password(self, service, user):
        return self.items.get((service, user))

    def delete_password(self, service, user):
        self.items.pop((service, user), None)


@pytest.fixture
def keyring(monkeypatch):
    fake = FakeKeyring()
    monkeypatch.setattr(login, "_keyring", lambda: fake)
    return fake


def test_credentials_round_trip_and_password_never_in_settings(app_home, keyring):
    settings = Settings.load()
    login.save_credentials(settings, " shop ", "s3cret-pw")
    loaded = login.load_credentials(Settings.load())
    assert loaded == login.Credentials("shop", "s3cret-pw")
    assert "s3cret-pw" not in settings.path.read_text(encoding="utf-8")
    assert json.loads(settings.path.read_text(encoding="utf-8"))["login_user"] == "shop"
    for path in app_home.rglob("*"):
        if path.is_file():
            assert b"s3cret-pw" not in path.read_bytes()


def test_forget_and_changed_username_remove_old_password(app_home, keyring):
    settings = Settings.load()
    login.save_credentials(settings, "one", "pw1")
    login.save_credentials(settings, "two", "pw2")
    assert list(keyring.items) == [(login.SERVICE, "two")]
    login.forget_credentials(settings)
    assert keyring.items == {} and login.load_credentials(settings) is None


def test_save_needs_both_fields_and_a_backend(app_home, monkeypatch, keyring):
    settings = Settings.load()
    with pytest.raises(ValueError):
        login.save_credentials(settings, "shop", "")
    monkeypatch.setattr(login, "_keyring", lambda: None)
    with pytest.raises(ValueError):
        login.save_credentials(settings, "shop", "pw")
    assert login.load_credentials(settings) is None


def test_pick_program_needs_exactly_one_month_and_year_match():
    options = ["Choose...", "ATD September 2026 Spiff", "ATD October 2026 Spiff", "Old September 2025"]
    assert login.pick_program(options, "2026-09") == 1
    assert login.pick_program(options, "2026-10") == 2
    assert login.pick_program(options, "2026-11") is None
    assert login.pick_program(options + ["Another September 2026"], "2026-09") is None
    assert login.pick_program(options, "unknown-20261007") is None


def test_old_config_without_login_section_still_loads(app_home):
    from auto_spiffer import paths
    path = paths.ensure_data_file("config.toml")
    text = path.read_text(encoding="utf-8")
    path.write_text(text[:text.index("# Automatic login")], encoding="utf-8")
    cfg = load_config()
    assert cfg.login.claim_url.endswith("submitsale.aspx") and cfg.login.password


# ---------------------------------------------------------------- a fake site
LOGIN_PAGE = """<form onsubmit="return false"><input type=text id=u><input type=password id=p>
<input type=submit id=go value=Go onclick="fakeLogin()"></form>
<script>function fakeLogin(){ fetch('/attempt?u='+u.value+'&p='+p.value).then(r=>r.text()).then(t=>{
 if(t==='ok') setTimeout(()=>{location='/authorized/claims/submitsale.aspx'},700); else document.body.append('bad'); }); }</script>"""
PICKER = """<select id=prog><option value=''>Choose</option><option value=a>ATD September 2026 Spiff</option>
<option value=b>ATD October 2026 Spiff</option></select><div id=chosen></div>
<script>prog.onchange=()=>{chosen.textContent=prog.value}</script>"""


@pytest.fixture
def site(app_home):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = launch_chromium(p, "auto", True)
        context = browser.new_context()
        state = {"attempts": 0, "logged_in": False, "password": "right"}

        def handler(route):
            url = route.request.url
            if "/attempt" in url:
                state["attempts"] += 1
                good = f"p={state['password']}" in url
                state["logged_in"] = state["logged_in"] or good
                route.fulfill(body="ok" if good else "no", content_type="text/plain")
            elif "submitsale" in url:
                body = PICKER if state["logged_in"] else LOGIN_PAGE
                route.fulfill(body=body, content_type="text/html")
            else:
                route.fulfill(body=LOGIN_PAGE, content_type="text/html")

        context.route("http://fake.test/**", handler)
        page = context.new_page()
        cfg = load_config()
        cfg.live_url = "http://fake.test/"
        cfg.login.claim_url = "http://fake.test/authorized/claims/submitsale.aspx"
        cfg.login.form_wait = 3
        cfg.login.login_wait = 3
        page.goto(cfg.live_url)
        yield page, cfg, state
        browser.close()


def test_login_then_picks_the_months_program(site):
    page, cfg, state = site
    result = login.login_and_navigate(page, cfg, login.Credentials("shop", "right"), "2026-09")
    assert result.ok and "September 2026" in result.message
    assert page.locator("#chosen").inner_text() == "a"
    assert state["attempts"] == 1


def test_wrong_password_tries_once_and_stops(site):
    page, cfg, state = site
    result = login.login_and_navigate(page, cfg, login.Credentials("shop", "wrong"), "2026-09")
    assert not result.ok and "by hand" in result.message
    assert state["attempts"] == 1


def test_unmatched_month_waits_at_the_picker(site):
    page, cfg, _ = site
    result = login.login_and_navigate(page, cfg, login.Credentials("shop", "right"), "2026-11")
    assert not result.ok and "Pick the program" in result.message
    assert page.locator("#prog").count() == 1 and page.locator("#chosen").inner_text() == ""


def test_no_month_loaded_waits_at_the_picker(site):
    page, cfg, _ = site
    result = login.login_and_navigate(page, cfg, login.Credentials("shop", "right"), "")
    assert not result.ok and page.locator("#prog").count() == 1


# ------------------------------------------- program names and a dropdown that opens on click
def test_program_name_from_the_tire_list_is_matched_first():
    options = ["Select One", "September 2026 Pro Rewards", "October 2026 Pro Rewards"]
    assert login.pick_program(options, "2026-09", "September 2026 Pro Rewards") == 1
    assert login.pick_program(["Select One", "Fall Spiff Sep"], "2026-09", "Fall Spiff Sep") == 1
    assert login.pick_program(["Select One", "Fall Spiff Sep"], "2026-09") is None


STYLED_PICKER = """<div id=box>Select One</div><ul id=list style="display:none">
<li>August 2026 Pro Rewards</li><li>September 2026 Pro Rewards</li></ul><div id=chosen></div>
<script>box.onclick=()=>{list.style.display='block'};
list.querySelectorAll('li').forEach(li=>li.onclick=()=>{chosen.textContent=li.textContent;list.style.display='none'})</script>"""


@pytest.fixture
def styled_site(site):
    page, cfg, state = site
    page.context.unroute("http://fake.test/**")

    def handler(route):
        url = route.request.url
        if "/attempt" in url:
            state["attempts"] += 1
            good = f"p={state['password']}" in url
            state["logged_in"] = state["logged_in"] or good
            route.fulfill(body="ok" if good else "no", content_type="text/plain")
        elif "submitsale" in url:
            route.fulfill(body=STYLED_PICKER if state["logged_in"] else LOGIN_PAGE, content_type="text/html")
        else:
            route.fulfill(body=LOGIN_PAGE, content_type="text/html")

    page.context.route("http://fake.test/**", handler)
    page.goto("http://fake.test/")
    return page, cfg, state


def test_styled_dropdown_is_opened_and_the_month_clicked(styled_site):
    page, cfg, _ = styled_site
    result = login.login_and_navigate(page, cfg, login.Credentials("shop", "right"), "2026-09",
                                      "September 2026 Pro Rewards")
    assert result.ok and "September 2026 Pro Rewards" in result.message
    assert page.locator("#chosen").inner_text() == "September 2026 Pro Rewards"


def test_styled_dropdown_without_the_month_waits_and_saves_the_page(styled_site, app_home):
    page, cfg, _ = styled_site
    result = login.login_and_navigate(page, cfg, login.Credentials("shop", "right"), "2026-11",
                                      "November 2026 Pro Rewards")
    assert not result.ok and "Pick the program yourself" in result.message
    assert page.locator("#chosen").inner_text() == ""
    assert (app_home / "output" / "picker_page.html").is_file()


# ------------------------------------------------------- the login never holds up step 2
def test_the_login_runs_in_the_background_and_reports_when_done(app_home, monkeypatch):
    import threading
    from auto_spiffer import browser as browser_module
    from auto_spiffer.browser import BrowserSession
    release = threading.Event()
    monkeypatch.setattr(browser_module, "login_and_navigate",
                        lambda *a, **k: (release.wait(10), login.LoginResult(False, "slow login done"))[1])
    cfg = load_config()
    session = BrowserSession(cfg, test_mode=True, headless=True, credentials=login.Credentials("u", "p"))
    try:
        session.start()
    except Exception as exc:
        pytest.skip(f"no browser available: {exc}")
    try:
        assert session.begin_login() is True
        assert session.is_open and session.login_note() is None  # still logging in, window already usable
        release.set()
        session.call(lambda s: None, timeout=10)  # anything asked of the browser waits behind the login
        assert session.login_note() == "slow login done"
        assert session.login_note() is None  # reported once
    finally:
        release.set()
        session.close()


def test_waiting_for_the_login_box_to_go_ignores_a_page_that_is_mid_navigation():
    class Element:
        def is_visible(self):
            return False

    class Locator:
        def __init__(self, page):
            self.page = page

        def count(self):
            self.page.asked += 1
            if self.page.asked <= 3:  # Playwright raises while a page is being replaced
                raise RuntimeError("Execution context was destroyed, most likely because of a navigation")
            return 1

        def nth(self, _i):
            return Element()

    class Page:
        asked = 0

        def locator(self, _selector):
            return Locator(self)

        def wait_for_timeout(self, _ms):
            pass

    page = Page()
    assert login._wait_gone(page, "input[type='password']", 5) is True
    assert page.asked == 4  # three errors were waited out, not counted as "the box is gone"


# ----------------------------------------- the person taking over never waits on the login
def test_the_login_steps_aside_quickly_when_the_person_takes_over(site):
    import time
    page, cfg, _ = site
    page.set_content("<html><body>nothing to log in to</body></html>")  # no login box: it would wait
    cfg.login.form_wait = 30
    started = time.monotonic()
    result = login.login_and_navigate(page, cfg, login.Credentials("shop", "right"), "2026-09",
                                      stop=lambda: time.monotonic() - started > 0.5)
    assert not result.ok and result.message == ""
    assert time.monotonic() - started < 3


def test_nothing_to_do_when_already_on_the_claim_page(app_home):
    from auto_spiffer.browser import BrowserSession, saved_page_path
    session = BrowserSession(load_config(), test_mode=True, headless=True)
    try:
        session.start()
    except Exception as exc:
        pytest.skip(f"no browser available: {exc}")
    try:
        result = session.call(lambda s: login.login_and_navigate(
            s.page, s.cfg, login.Credentials("u", "p"), "2026-09"))
        assert result.ok and "Already on the claim page" in result.message
    finally:
        session.close()


def test_cancel_login_frees_the_browser_for_the_next_job(app_home, monkeypatch):
    import time
    from auto_spiffer import browser as browser_module
    from auto_spiffer.browser import BrowserSession

    def stubborn_login(page, cfg, creds, month, program, stop):
        while not stop():
            time.sleep(0.05)
        return login.LoginResult(False, "")
    monkeypatch.setattr(browser_module, "login_and_navigate", stubborn_login)
    session = BrowserSession(load_config(), test_mode=True, headless=True, credentials=login.Credentials("u", "p"))
    try:
        session.start()
    except Exception as exc:
        pytest.skip(f"no browser available: {exc}")
    try:
        session.begin_login()
        session.cancel_login()  # what step 2 does first
        started = time.monotonic()
        assert session.call(lambda s: "ran", timeout=5) == "ran"
        assert time.monotonic() - started < 2
        assert session.login_note() is None  # a quiet step-aside is not worth a log line
    finally:
        session.close()


def test_a_slow_page_load_in_the_login_can_still_be_interrupted(app_home):
    """The login must never hold the browser for long: even mid-navigation it steps aside at once."""
    import http.server
    import threading
    import time

    class Slow(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            if "slow" in self.path:
                time.sleep(6)
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"<html><body>hello</body></html>")

        def log_message(self, *a):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Slow)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    from playwright.sync_api import sync_playwright
    try:
        with sync_playwright() as p:
            browser = launch_chromium(p, "auto", True)
            page = browser.new_page()
            page.goto(base + "/")
            started = time.monotonic()
            with pytest.raises(login._Stopped):
                login._goto(page, base + "/slow", stop=lambda: time.monotonic() - started > 0.6)
            assert time.monotonic() - started < 3  # not the 6 seconds the server takes
            browser.close()
    finally:
        server.shutdown()
