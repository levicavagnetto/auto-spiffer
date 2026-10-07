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
 if(t==='ok') location='/authorized/claims/submitsale.aspx'; else document.body.append('bad'); }); }</script>"""
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
