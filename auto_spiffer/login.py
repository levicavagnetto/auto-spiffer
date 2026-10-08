"""Saved login for the ATD ProRewards site, and the steps that use it.

The username is kept in data/settings.json. The password is kept ONLY in Windows Credential Manager
(through the `keyring` package), never in a file the app writes.

`login_and_navigate` logs in once, goes to the claim page, and picks the program for the loaded month.
It never raises and never retries a login. When anything is unclear it stops and says so, leaving the
browser where it is so the person can finish by hand.
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

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


def program_matches(text: str, month: str, program: str = "") -> bool:
    """True when a dropdown entry is this month's program: it holds the program's name (from the loaded
    tire list), or else the month's name and year."""
    if program and program.strip().lower() in text.lower():
        return True
    terms = month_terms(month)
    return terms is not None and terms[0] in text.lower() and terms[1] in text


def pick_program(options: list[str], month: str, program: str = "") -> Optional[int]:
    """Index of the one option that is this month's program, or None when none or several match."""
    hits = [i for i, text in enumerate(options) if program_matches(text, month, program)]
    return hits[0] if len(hits) == 1 else None


# --------------------------------------------------------------- the browser steps
def _count_visible(page, selector: str) -> int:
    try:
        loc = page.locator(selector)
        return sum(1 for i in range(min(loc.count(), 5)) if loc.nth(i).is_visible())
    except Exception:
        return 0


class _Stopped(Exception):
    """The person took over (started the run), so the automatic login gives up at once."""


def _halt(stop) -> None:
    if stop is not None and stop():
        raise _Stopped()


def _wait_visible(page, selector: str, seconds: float, state: str = "visible", stop=None) -> bool:
    end = seconds
    while end > 0:
        _halt(stop)
        try:
            page.locator(selector).first.wait_for(state=state, timeout=250)
            return True
        except Exception:
            end -= 0.25
    return False


def _wait_gone(page, selector: str, seconds: float, stop=None) -> bool:
    """True once the element is no longer visible. A page that is in the middle of navigating cannot be
    asked (that is an error, not an answer), so keep waiting until it can be."""
    end = seconds
    step = 0.25
    while end > 0:
        _halt(stop)
        try:
            loc = page.locator(selector)
            if not any(loc.nth(i).is_visible() for i in range(min(loc.count(), 5))):
                return True
        except Exception:
            pass  # the page is changing under us; ask again shortly
        page.wait_for_timeout(int(step * 1000))
        end -= step
    return False


def _settle(page, seconds: float, stop=None) -> None:
    """Wait for the page to finish loading (and for any redirect the site started to land)."""
    end = seconds
    while end > 0:
        _halt(stop)
        try:
            page.wait_for_load_state("load", timeout=250)
            return
        except Exception:
            end -= 0.25


def _goto(page, url: str, stop=None, seconds: float = 20) -> None:
    """Send the page to a URL without ever blocking for long: start the navigation from inside the page,
    then watch for it in short slices, so the person starting the run can interrupt at any moment.
    A page that ends up somewhere else (the site redirected) is not an error here: the caller looks."""
    target = url.split("?")[0].lower()

    def there() -> bool:
        return page.url.split("?")[0].lower() == target

    if not there():
        try:
            page.evaluate("u => { window.location.href = u; }", url)
        except Exception:
            pass  # the page was already changing; whatever it becomes is checked next
    end = seconds
    while end > 0:
        _halt(stop)
        try:
            if there():
                page.wait_for_load_state("domcontentloaded", timeout=250)
                return
            page.wait_for_timeout(250)
        except Exception:
            time.sleep(0.25)  # still loading, or the page is changing: look again shortly
        end -= 0.25


def _safe_to_click(selector: str, cfg) -> bool:
    return selector not in cfg.never_click


def login_and_navigate(page, cfg, creds: Credentials, month: str = "", program: str = "",
                       stop=None) -> LoginResult:
    """Log in (once), open the claim page, and pick the month's program. Never raises.
    `stop` is asked often: when it returns True the person has taken over and this ends quietly."""
    started = time.monotonic()
    try:
        result = _login_and_navigate(page, cfg, creds, month, program, stop)
    except _Stopped:
        result = LoginResult(False, "")
    except Exception as exc:  # the person finishes by hand, whatever went wrong
        detail = str(exc).splitlines()[0] if str(exc) else exc.__class__.__name__
        result = LoginResult(False, f"The automatic login stopped ({detail}). Finish by hand.")
    logging.info("Automatic login took %.1fs: %s", time.monotonic() - started, result.message or "(stepped aside)")
    return result


def _login_and_navigate(page, cfg, creds: Credentials, month: str, program: str, stop) -> LoginResult:
    lg = cfg.login
    waits = cfg.timeouts

    if _count_visible(page, cfg.selectors["date"]):
        return LoginResult(True, "Already on the claim page.")  # nothing to do: the person got there first
    if _wait_visible(page, lg.password, lg.form_wait, stop=stop):
        user_box = page.locator(lg.username).first
        user_box.fill(creds.username, timeout=3000)
        page.locator(lg.password).first.fill(creds.password, timeout=3000)
        submit = lg.submit
        if _count_visible(page, submit) and _safe_to_click(submit, cfg):
            page.locator(submit).first.click(timeout=3000)
        else:
            page.locator(lg.password).first.press("Enter", timeout=3000)
        if not _wait_gone(page, lg.password, lg.login_wait, stop):
            return LoginResult(False, "The site did not finish logging in (wrong password, a code, or a "
                                      "CAPTCHA?). The app only tries once. Finish logging in by hand.")

    _settle(page, waits["action"], stop)  # the site may still be redirecting after the login
    page.wait_for_timeout(300)
    _goto(page, lg.claim_url, stop)
    if _count_visible(page, lg.password):
        return LoginResult(False, "The site is asking for a login again. Log in by hand.")
    if page.locator(cfg.selectors["date"]).count() > 0:
        return LoginResult(True, "Logged in and on the claim page.")

    if not month and not program:
        return LoginResult(False, "Logged in and on the claim page list. No month is loaded, so pick the "
                                  "program yourself.")
    chosen = _choose_program(page, cfg, month, program, stop)
    if chosen:
        return _open_claim_form(page, cfg, chosen, stop)
    saved = _save_page(page)
    where = f" The page was saved to {saved} so the app can be taught its layout." if saved else ""
    return LoginResult(False, "Logged in, but this month's program was not found in the list. Pick the "
                              f"program yourself.{where}")


def _open_claim_form(page, cfg, chosen: str, stop) -> LoginResult:
    """Click the page's NEXT button (the one that opens the claim form for the chosen program).
    Only ever done here, on the program page, and only for a single plain match: never on the claim form."""
    lg = cfg.login
    done = f"Logged in and chose '{chosen}'"
    date_box = cfg.selectors["date"]

    def form_open() -> bool:
        return _count_visible(page, date_box) > 0

    page.wait_for_timeout(300)  # choosing may already have moved the page on its own
    if form_open():
        return LoginResult(True, done + " and opened the claim form.")
    rx = re.compile(lg.program_next, re.IGNORECASE)
    found = []
    for role in ("button", "link"):
        buttons = page.get_by_role(role, name=rx)
        found += [buttons.nth(i) for i in range(min(buttons.count(), 6)) if buttons.nth(i).is_visible()]
    if len(found) != 1:
        return LoginResult(False, done + ". Click NEXT yourself.")
    button = found[0]
    ident = button.get_attribute("id") or ""
    if (ident and f"#{ident}" in cfg.never_click) or form_open():
        return LoginResult(False, done + ". Click NEXT yourself.")  # never press a claim-form button
    button.click(timeout=3000)
    end = lg.form_open_wait
    while end > 0:
        _halt(stop)
        try:
            if form_open():
                return LoginResult(True, done + " and opened the claim form.")
        except Exception:
            pass  # the page is changing under us
        page.wait_for_timeout(250)
        end -= 0.25
    return LoginResult(False, done + " and clicked NEXT, but the claim form did not appear. Check the page.")


def _choose_program(page, cfg, month: str, program: str, stop) -> Optional[str]:
    """Pick this month's program, trying the ways the dropdown might be built. Each way is tried on its
    own, so one that fails (or does not apply) never stops the next from being tried."""
    for way in (_choose_in_dropdown, _choose_in_select, _choose_visible):
        try:
            chosen = way(page, cfg.login, month, program, stop)
        except _Stopped:
            raise
        except Exception:
            chosen = None
        if chosen:
            return chosen
    return None


def _visible_texts(loc, limit: int = 60) -> list[tuple[int, str]]:
    return [(i, _item_text(loc.nth(i))) for i in range(min(loc.count(), limit)) if loc.nth(i).is_visible()]


def _choose_in_dropdown(page, lg, month: str, program: str, stop=None) -> Optional[str]:
    """The dropdown as a person uses it: click the box to open it, then click this month's entry."""
    trigger = page.locator(lg.program_trigger)
    if not _count_visible(page, lg.program_trigger):
        return None  # this page has no such dropdown
    trigger.first.click(timeout=3000)
    entries = page.locator(lg.program_entries)
    shown: list[tuple[int, str]] = []
    for _ in range(14):  # up to ~2 seconds for the list to open
        _halt(stop)
        shown = _visible_texts(entries)
        if shown:
            break
        page.wait_for_timeout(150)
    index = pick_program([t for _i, t in shown], month, program)
    if index is None:
        page.keyboard.press("Escape")  # close it again without choosing anything
        return None
    entry_number, text = shown[index]
    entries.nth(entry_number).click(timeout=3000)
    page.wait_for_timeout(300)
    now = _item_text(trigger.first)  # the closed box now shows what was picked
    return text if program_matches(now, month, program) else None


def _choose_in_select(page, lg, month: str, program: str, stop=None) -> Optional[str]:
    """A plain list, visible or hidden behind a styled one: set it directly and tell the page it changed
    (Playwright would refuse to act on a hidden list, so this is done from inside the page)."""
    options = page.locator(lg.program_items)
    if options.count() == 0:
        return None
    texts = [_item_text(options.nth(i)) for i in range(options.count())]
    index = pick_program(texts, month, program)
    if index is None:
        return None
    options.nth(index).evaluate(
        """o => {
            const s = o.closest('select');
            s.value = o.value;
            s.dispatchEvent(new Event('input', { bubbles: true }));
            s.dispatchEvent(new Event('change', { bubbles: true }));
            if (window.jQuery) window.jQuery(s).trigger('chosen:updated');
        }""")
    page.wait_for_timeout(300)
    return texts[index].strip()


def _choose_visible(page, lg, month: str, program: str, stop=None) -> Optional[str]:
    """Open the 'Select One' dropdown by clicking it, then click the one visible entry for this month."""
    terms = month_terms(month)
    parts = []
    if program.strip():
        parts.append(re.escape(program.strip()))
    if terms:
        parts.append(re.escape(terms[0]) + r".{0,60}?" + re.escape(terms[1]))
    if not parts:
        return None
    pattern = re.compile("|".join(parts), re.IGNORECASE)

    trigger = page.get_by_text(re.compile(lg.program_prompt, re.IGNORECASE))
    for i in range(min(trigger.count(), 6)):
        if trigger.nth(i).is_visible():
            trigger.nth(i).click(timeout=3000)
            break
    seen: dict[str, object] = {}
    deadline = 2.0
    while deadline > 0 and not seen:
        _halt(stop)
        page.wait_for_timeout(150)
        deadline -= 0.15
        entries = page.get_by_text(pattern)
        for i in range(min(entries.count(), 30)):
            entry = entries.nth(i)
            if entry.is_visible():
                seen.setdefault(_item_text(entry), entry)
    if len(seen) != 1:
        return None
    text, entry = next(iter(seen.items()))
    entry.click(timeout=3000)  # type: ignore[attr-defined]
    return text


def _save_page(page) -> str:
    """Keep a copy of the page that could not be read, for fixing the selectors."""
    try:
        from auto_spiffer import paths
        target = paths.output_dir() / "picker_page.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(page.content(), encoding="utf-8")
        return str(target)
    except Exception:
        return ""


def _item_text(item) -> str:
    return re.sub(r"\s+", " ", item.inner_text() or "").strip()
