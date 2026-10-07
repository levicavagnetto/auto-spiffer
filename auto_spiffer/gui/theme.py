"""Colors, fonts, and ttk styling shared by every page (taken from the approved sidebar mockup)."""
from __future__ import annotations

import sys
import tkinter as tk
from pathlib import Path
from tkinter import ttk

FONT = "Segoe UI"

SIDEBAR_BG = "#26384a"
SIDEBAR_ACTIVE = "#3b5873"
SIDEBAR_TEXT = "#ffffff"
SIDEBAR_MUTED = "#9db4c8"

GOOD = "#1b7a3a"
BAD = "#b00020"
WARN_BG = "#fff4ce"
WARN_FG = "#5c4400"
INFO_BG = "#e8f1fb"
INFO_FG = "#1f4e79"
SUBTLE = "#555555"

# Row colors for the Review table, by ClaimRow status.
ROW_STYLES = {
    "ready": {"background": "#e6f4ea"},
    "attention": {"background": "#fff4ce"},
    "not_eligible": {"background": "#efefef", "foreground": "#777777"},
    "problem": {"background": "#fde7e9"},
    "already_entered": {"background": "#e8f1fb"},
    "excluded": {"background": "#efefef", "foreground": "#999999"},
    "entered": {"background": "#c8e6c9"},
    "failed": {"background": "#f5b7b1"},
}
STATUS_TEXT = {
    "ready": "Ready", "attention": "Attention", "not_eligible": "Not eligible", "problem": "Problem",
    "already_entered": "Already entered", "excluded": "Excluded", "entered": "Entered", "failed": "Failed",
}
CARD_COLORS = {"ready": GOOD, "attention": "#b8860b", "not_eligible": "#777777", "problem": BAD}


def set_window_icon(root: tk.Tk) -> None:
    """Use assets/icon.png as the window and taskbar icon (it is bundled next to the code in the .exe)."""
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent.parent))
    icon = base / "assets" / "icon.png"
    try:
        root.iconphoto(True, tk.PhotoImage(file=str(icon)))
    except tk.TclError:
        pass  # a missing icon is never worth stopping for


def apply_theme(root: tk.Tk) -> None:
    style = ttk.Style(root)
    try:
        style.theme_use("vista")
    except tk.TclError:
        pass  # another platform: keep whatever theme Tk picked
    style.configure("Title.TLabel", font=(FONT, 15, "bold"))
    style.configure("Subtle.TLabel", foreground=SUBTLE)
    style.configure("Good.TLabel", foreground=GOOD)
    style.configure("Bad.TLabel", foreground=BAD)
    style.configure("Treeview", rowheight=22)


def style_rows(tree: ttk.Treeview) -> None:
    for status, options in ROW_STYLES.items():
        tree.tag_configure(status, **options)


def banner(parent, text: str, kind: str = "warn") -> tk.Label:
    bg, fg = (WARN_BG, WARN_FG) if kind == "warn" else (INFO_BG, INFO_FG)
    return tk.Label(parent, text=text, bg=bg, fg=fg, anchor="w", justify="left", padx=10, pady=8,
                    wraplength=900)
