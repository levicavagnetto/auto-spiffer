"""Saved login for the ATD ProRewards site, and the steps that use it.

The username is kept in data/settings.json. The password is kept ONLY in Windows Credential Manager
(through the `keyring` package), never in a file the app writes.

`login_and_navigate` logs in once, goes to the claim page, and picks the program for the loaded month.
It never raises and never retries a login. When anything is unclear it stops and says so, leaving the
browser where it is so the person can finish by hand.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from auto_spiffer.settings import Settings

SERVICE = "Auto Spiffer"
USER_KEY = "login_user"


@dataclass(frozen=True)
class Credentials:
    username: str
    password: str


@dataclass(frozen=True)
class LoginResult:
    ok: bool
    message: str


# ------------------------------------------------------------------ storage
def _keyring():
    """The keyring module, or None when it (or a usable backend) is not available."""
    try:
        import keyring
        from keyring.backends import fail
        if isinstance(keyring.get_keyring(), fail.Keyring):
            return None
        return keyring
    except Exception:
        return None


def storage_available() -> bool:
    return _keyring() is not None


def saved_username(settings: Settings) -> str:
    return str(settings.get(USER_KEY) or "")


def save_credentials(settings: Settings, username: str, password: str) -> None:
    """Remember the username in settings and the password in Credential Manager."""
    username = username.strip()
    if not username or not password:
        raise ValueError("Enter both a username and a password.")
    store = _keyring()
    if store is None:
        raise ValueError("Windows Credential Manager is not available, so the password cannot be saved.")
    store.set_password(SERVICE, username, password)
    old = saved_username(settings)
    if old and old != username:
        _delete_password(store, old)
    settings.set(USER_KEY, username)
    settings.save()


def load_credentials(settings: Settings) -> Optional[Credentials]:
    username = saved_username(settings)
    store = _keyring()
    if not username or store is None:
        return None
    try:
        password = store.get_password(SERVICE, username)
    except Exception:
        return None
    return Credentials(username, password) if password else None


def forget_credentials(settings: Settings) -> None:
    username = saved_username(settings)
    store = _keyring()
    if username and store is not None:
        _delete_password(store, username)
    settings.set(USER_KEY, "")
    settings.save()


def _delete_password(store, username: str) -> None:
    try:
        store.delete_password(SERVICE, username)
    except Exception:
        pass  # nothing stored under that name


# --------------------------------------------------------------- the month
def month_terms(month: str) -> Optional[tuple[str, str]]:
    """('september', '2026') for the workspace folder name '2026-09', else None."""
    try:
        day = datetime.strptime(month, "%Y-%m")
    except (TypeError, ValueError):
        return None
    return day.strftime("%B").lower(), day.strftime("%Y")


def pick_program(options: list[str], month: str) -> Optional[int]:
    """Index of the one option naming the month and year, or None when none or several match."""
    terms = month_terms(month)
    if terms is None:
        return None
    name, year = terms
    hits = [i for i, text in enumerate(options) if name in text.lower() and year in text]
    return hits[0] if len(hits) == 1 else None


# --------------------------------------------------------------- the browser steps
def _count_visible(page, selector: str) -> int:
    try:
        loc = page.locator(selector)
        return sum(1 for i in range(min(loc.count(), 5)) if loc.nth(i).is_visible())
    except Exception:
        return 0


def _wait_visible(page, selector: str, seconds: float, state: str = "visible") -> bool:
    try:
        page.locator(selector).first.wait_for(state=state, timeout=seconds * 1000)
        return True
    except Exception:
        return False


def _wait_gone(page, selector: str, seconds: float) -> bool:
    end = seconds
    step = 0.25
    while end > 0:
        if _count_visible(page, selector) == 0:
            return True
        page.wait_for_timeout(int(step * 1000))
        end -= step
    return False


def _settle(page, seconds: float) -> None:
    try:
        page.wait_for_load_state("domcontentloaded", timeout=seconds * 1000)
    except Exception:
        pass


def _goto(page, url: str) -> None:
    """Open a page, trying once more if the site's own redirect interrupted the first try."""
    try:
        page.goto(url, wait_until="domcontentloaded")
    except Exception as exc:
        if "interrupted" not in str(exc):
            raise
        _settle(page, 10)
        page.goto(url, wait_until="domcontentloaded")


def _safe_to_click(selector: str, cfg) -> bool:
    return selector not in cfg.never_click


def login_and_navigate(page, cfg, creds: Credentials, month: str = "") -> LoginResult:
    """Log in (once), open the claim page, and pick the month's program. Never raises."""
    try:
        return _login_and_navigate(page, cfg, creds, month)
    except Exception as exc:  # the person finishes by hand, whatever went wrong
        detail = str(exc).splitlines()[0] if str(exc) else exc.__class__.__name__
        return LoginResult(False, f"The automatic login stopped ({detail}). Finish by hand.")


def _login_and_navigate(page, cfg, creds: Credentials, month: str) -> LoginResult:
    lg = cfg.login
    waits = cfg.timeouts

    if _wait_visible(page, lg.password, lg.form_wait):
        user_box = page.locator(lg.username).first
        user_box.fill(creds.username)
        page.locator(lg.password).first.fill(creds.password)
        submit = lg.submit
        if _count_visible(page, submit) and _safe_to_click(submit, cfg):
            page.locator(submit).first.click(timeout=waits["action"] * 1000)
        else:
            page.locator(lg.password).first.press("Enter")
        if not _wait_gone(page, lg.password, lg.login_wait):
            return LoginResult(False, "The site did not finish logging in (wrong password, a code, or a "
                                      "CAPTCHA?). The app only tries once. Finish logging in by hand.")

    _settle(page, waits["action"])  # the site may still be redirecting after the login
    _goto(page, lg.claim_url)
    if _count_visible(page, lg.password):
        return LoginResult(False, "The site is asking for a login again. Log in by hand.")
    if page.locator(cfg.selectors["date"]).count() > 0:
        return LoginResult(True, "Logged in and on the claim page.")

    if not month:
        return LoginResult(False, "Logged in and on the claim page list. No month is loaded, so pick the "
                                  "program yourself.")
    if not _wait_visible(page, lg.program_items, waits["action"], state="attached"):
        return LoginResult(False, "Logged in, but the program list was not found. Pick the program yourself.")
    items = page.locator(lg.program_items)
    texts = [_item_text(items.nth(i)) for i in range(items.count())]
    index = pick_program(texts, month)
    if index is None:
        return LoginResult(False, "Logged in, but no single program matches this month. Pick the program "
                                  "yourself.")
    _choose(page, items.nth(index), lg, cfg)
    return LoginResult(True, f"Logged in and chose '{texts[index].strip()}'.")


def _item_text(item) -> str:
    return re.sub(r"\s+", " ", item.inner_text() or "").strip()


def _choose(page, item: Any, lg, cfg) -> None:
    tag = (item.evaluate("e => e.tagName") or "").lower()
    if tag == "option":
        select = item.locator("xpath=ancestor::select")
        select.select_option(value=item.get_attribute("value"))
        if lg.program_go and _count_visible(page, lg.program_go) and _safe_to_click(lg.program_go, cfg):
            page.locator(lg.program_go).first.click(timeout=cfg.timeouts["action"] * 1000)
    else:
        item.click(timeout=cfg.timeouts["action"] * 1000)
    try:
        page.wait_for_load_state("domcontentloaded", timeout=cfg.timeouts["action"] * 1000)
    except Exception:
        pass
