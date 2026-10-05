"""Tkinter mockups for Auto Spiffer. Static, sample data only.

Run:
    python mockup_gui.py A          # design A: tabs
    python mockup_gui.py B          # design B: sidebar
    python mockup_gui.py A --shots out_dir   # save screenshots and exit
"""
import ctypes
import os
import sys
import tkinter as tk
from tkinter import ttk
from tkinter.scrolledtext import ScrolledText

from mockup_data import LOG, ROWS, TIRES

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(1)
except Exception:
    pass

TAGS = {
    "Ready": dict(background="#e6f4ea"),
    "Attention": dict(background="#fff4ce"),
    "Not eligible": dict(background="#efefef", foreground="#777777"),
    "Problem": dict(background="#fde7e9"),
}


# ---------------------------------------------------------------- shared bits
def header(parent, warn=True):
    bar = ttk.Frame(parent, padding=(10, 8))
    bar.pack(fill="x")
    ttk.Label(bar, text="Auto Spiffer", font=("Segoe UI", 15, "bold")).pack(side="left")
    right = ttk.Frame(bar)
    right.pack(side="right")
    ttk.Label(right, text="Report: September 2026 (9/1 - 9/30)").grid(row=0, column=0, sticky="e")
    tl = ttk.Label(right, text="Tire list: October 2026 Pro Rewards  \u26a0" if warn else
                   "Tire list: September 2026 Pro Rewards  \u2714",
                   foreground="#b00020" if warn else "#1b7a3a")
    tl.grid(row=1, column=0, sticky="e")
    return bar


def review_tree(parent, height=14):
    cols = ("date", "inv", "desc", "tire", "qty", "pdf", "status")
    frame = ttk.Frame(parent)
    tree = ttk.Treeview(frame, columns=cols, show="headings", height=height, selectmode="browse")
    heads = [("date", "Date", 92), ("inv", "Invoice #", 70), ("desc", "Report description", 290),
             ("tire", "Matched ClaimForm tire", 320), ("qty", "Qty", 40), ("pdf", "PDF", 60),
             ("status", "Status", 100)]
    for key, text, width in heads:
        tree.heading(key, text=text)
        tree.column(key, width=width, anchor="center" if key in ("qty", "pdf", "inv", "date", "status") else "w")
    for tag, opts in TAGS.items():
        tree.tag_configure(tag, **opts)
    for r in ROWS:
        tree.insert("", "end", values=r, tags=(r[6],))
    sb = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
    tree.configure(yscrollcommand=sb.set)
    tree.pack(side="left", fill="both", expand=True)
    sb.pack(side="right", fill="y")
    return frame, tree


def log_box(parent, height=11):
    box = ScrolledText(parent, height=height, font=("Consolas", 9), wrap="none")
    box.insert("end", "\n".join(LOG))
    box.configure(state="disabled")
    return box


# ------------------------------------------------------------------- tab pages
def page_inputs(parent):
    f = ttk.Frame(parent, padding=14)

    banner = tk.Label(
        f, anchor="w", justify="left", bg="#fff4ce", fg="#5c4400", padx=10, pady=8,
        text="\u26a0  The report covers 9/1/2026 - 9/30/2026, but the loaded tire list is for\n"
             "    10/1/2026 - 10/31/2026. Load the September ClaimForm.pdf below to continue.")
    banner.pack(fill="x", pady=(0, 10))

    g1 = ttk.LabelFrame(f, text=" 1.  Material Sales report ", padding=10)
    g1.pack(fill="x", pady=4)
    e1 = ttk.Entry(g1, width=70)
    e1.insert(0, r"C:\Users\LeviCavagnetto\Downloads\Material-Sales.pdf")
    e1.pack(side="left", fill="x", expand=True)
    ttk.Button(g1, text="Browse...").pack(side="left", padx=(8, 0))
    ttk.Label(g1, text="\u2714  29 rows, 27 sales read", foreground="#1b7a3a").pack(side="left", padx=(12, 0))

    g2 = ttk.LabelFrame(f, text=" 2.  Invoice PDFs ", padding=10)
    g2.pack(fill="x", pady=4)
    top = ttk.Frame(g2)
    top.pack(fill="x")
    lb = tk.Listbox(top, height=4, activestyle="none")
    for n in ("214195.pdf", "214288.pdf", "214341.pdf", "214354.pdf", "214502.pdf", "214533.pdf", "214629.pdf"):
        lb.insert("end", n)
    lb.pack(side="left", fill="both", expand=True)
    sb = ttk.Scrollbar(top, orient="vertical", command=lb.yview)
    lb.configure(yscrollcommand=sb.set)
    sb.pack(side="left", fill="y")
    btns = ttk.Frame(top)
    btns.pack(side="left", padx=(10, 0), anchor="n")
    ttk.Button(btns, text="Add folder...").pack(fill="x", pady=1)
    ttk.Button(btns, text="Add files...").pack(fill="x", pady=1)
    ttk.Button(btns, text="Remove selected").pack(fill="x", pady=1)
    ttk.Button(btns, text="Clear").pack(fill="x", pady=1)
    tk.Label(g2, text="\u2193   Drag PDFs or a folder here   \u2193", bg="#f3f3f3", fg="#666666",
             relief="groove", pady=8).pack(fill="x", pady=(8, 4))
    ttk.Label(g2, text="\u2714  26 PDFs found      \u26a0  1 report invoice has no PDF (214983)",
              foreground="#1b7a3a").pack(anchor="w")

    g3 = ttk.LabelFrame(f, text=" 3.  Tire list (ClaimForm.pdf) ", padding=10)
    g3.pack(fill="x", pady=4)
    ttk.Label(g3, text="Loaded: October 2026 Pro Rewards   (10/1 - 10/31/2026),  74 tires,  imported 10/4/2026").pack(side="left")
    ttk.Button(g3, text="Load ClaimForm.pdf...").pack(side="right")

    foot = ttk.Frame(f)
    foot.pack(fill="x", pady=(10, 0))
    ttk.Button(foot, text="Read files and continue  \u25b6", state="disabled").pack(side="right")
    ttk.Label(foot, text="Continue is enabled when the report, invoices, and matching tire list are loaded.",
              foreground="#666666").pack(side="left")
    return f


def page_review(parent):
    f = ttk.Frame(parent, padding=(12, 10))
    bar = ttk.Frame(f)
    bar.pack(fill="x", pady=(0, 6))
    v = f.v = tk.StringVar(value="all")
    for text, val in (("All (27)", "all"), ("Needs attention (2)", "a"), ("Not eligible (7)", "n"), ("Problems (1)", "p")):
        ttk.Radiobutton(bar, text=text, variable=v, value=val).pack(side="left", padx=(0, 12))
    ttk.Entry(bar, width=24).pack(side="right")
    ttk.Label(bar, text="Search:").pack(side="right", padx=(0, 4))

    frame, tree = review_tree(f)
    frame.pack(fill="both", expand=True)
    tree.selection_set(tree.get_children()[5])

    ttk.Label(f, text="*  quantity merged from 2 report rows (1 + 3)", foreground="#666666").pack(anchor="w", pady=(4, 0))

    foot = ttk.Frame(f)
    foot.pack(fill="x", pady=(8, 0))
    ttk.Label(foot, text="Ready 17    Needs attention 2    Not eligible 7    Problem 1        Total qty to enter: 62",
              font=("Segoe UI", 9, "bold")).pack(side="left")
    ttk.Button(foot, text="Continue  \u25b6", state="disabled").pack(side="right")
    ttk.Button(foot, text="Export CSV").pack(side="right", padx=6)
    ttk.Button(foot, text="Exclude row").pack(side="right")
    ttk.Button(foot, text="Fix selected...").pack(side="right", padx=6)
    return f


def page_run(parent):
    f = ttk.Frame(parent, padding=14)

    s1 = ttk.LabelFrame(f, text=" Step 1 ", padding=10)
    s1.pack(fill="x", pady=4)
    ttk.Button(s1, text="Open claim site").pack(side="left")
    ttk.Label(s1, text="A browser opens. Log in, then go to  \u201cSubmit a Sales Claim\u201d  for the correct program.").pack(side="left", padx=10)

    s2 = ttk.LabelFrame(f, text=" Step 2 ", padding=10)
    s2.pack(fill="x", pady=4)
    ttk.Button(s2, text="I'm on the page, start entering").pack(side="left")
    ttk.Label(s2, text="\u2714  Page check passed: September 2026 Pro Rewards, dates 9/1 - 9/30, all 17 tires found in the list",
              foreground="#1b7a3a").pack(side="left", padx=10)

    p = ttk.LabelFrame(f, text=" Progress ", padding=10)
    p.pack(fill="x", pady=4)
    row = ttk.Frame(p)
    row.pack(fill="x")
    pb = ttk.Progressbar(row, length=500, maximum=100, value=44)
    pb.pack(side="left", fill="x", expand=True)
    ttk.Label(row, text="  12 of 27 sales").pack(side="left")
    ttk.Button(row, text="Pause").pack(side="left", padx=(12, 4))
    ttk.Button(row, text="Stop").pack(side="left")

    lg = ttk.LabelFrame(f, text=" Log ", padding=6)
    lg.pack(fill="both", expand=True, pady=4)
    log_box(lg).pack(fill="both", expand=True)

    ttk.Label(f, text="Nothing has been submitted. When finished, review the page and submit it yourself.",
              foreground="#555555").pack(anchor="w", pady=(6, 0))
    return f


def page_tires(parent):
    f = ttk.Frame(parent, padding=14)
    top = ttk.Frame(f)
    top.pack(fill="x")
    ttk.Label(top, text="Loaded: October 2026 Pro Rewards   (10/1 - 10/31/2026)   74 tires   imported 10/4/2026").pack(side="left")
    ttk.Button(top, text="History \u25be").pack(side="right")
    ttk.Button(top, text="Export CSV").pack(side="right", padx=6)
    ttk.Button(top, text="Update from ClaimForm.pdf...").pack(side="right")
    sr = ttk.Frame(f)
    sr.pack(fill="x", pady=8)
    ttk.Label(sr, text="Search:").pack(side="left")
    ttk.Entry(sr, width=30).pack(side="left", padx=6)

    frame = ttk.Frame(f)
    frame.pack(fill="both", expand=True)
    tree = ttk.Treeview(frame, columns=("tire", "val"), show="headings", height=14)
    tree.heading("tire", text="Tire (exact website wording)")
    tree.heading("val", text="Value")
    tree.column("tire", width=560, anchor="w")
    tree.column("val", width=80, anchor="center")
    for t in TIRES:
        tree.insert("", "end", values=t)
    sb = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
    tree.configure(yscrollcommand=sb.set)
    tree.pack(side="left", fill="both", expand=True)
    sb.pack(side="right", fill="y")
    return f


# --------------------------------------------------------------- fix dialog
def fix_dialog(root):
    d = tk.Toplevel(root)
    d.title("Choose the ClaimForm tire")
    d.geometry("660x560+%d+%d" % (root.winfo_rootx() + 190, root.winfo_rooty() + 70))
    d.transient(root)
    f = ttk.Frame(d, padding=14)
    f.pack(fill="both", expand=True)
    ttk.Label(f, text="Report says:", font=("Segoe UI", 9, "bold")).pack(anchor="w")
    tk.Label(f, text="245/55R19 103H NOK ONE BW 80K 245/55R19 103H (80K)      qty 4",
             bg="#f3f3f3", anchor="w", padx=8, pady=6, relief="groove").pack(fill="x", pady=(2, 10))
    ttk.Label(f, text="Best guesses:", font=("Segoe UI", 9, "bold")).pack(anchor="w")
    best = tk.Listbox(f, height=3, activestyle="none")
    best.insert("end", "Nokian One HT - Light Truck Tires        (74% match, missing \"HT\")")
    best.insert("end", "Nokian Outpost nAT - Light Truck Tires    (31%)")
    best.insert("end", "Nokian Remedy WRG5 - Passenger Tires      (28%)")
    best.selection_set(0)
    best.pack(fill="x", pady=(2, 10))
    sr = ttk.Frame(f)
    sr.pack(fill="x")
    ttk.Label(sr, text="Or search all tires:").pack(side="left")
    ttk.Entry(sr, width=30).pack(side="left", padx=6)
    lb = tk.Listbox(f, height=6, activestyle="none")
    for t, _ in TIRES:
        lb.insert("end", t)
    lb.pack(fill="both", expand=True, pady=(4, 8))
    d.v = tk.BooleanVar(value=True)
    ttk.Checkbutton(f, text="Remember this choice for future months", variable=d.v).pack(anchor="w")
    d.skip = tk.BooleanVar(value=False)
    ttk.Checkbutton(f, text="This is not an eligible tire (skip it)", variable=d.skip).pack(anchor="w", pady=(4, 0))
    btn = ttk.Frame(f)
    btn.pack(fill="x", pady=(10, 0))
    ttk.Button(btn, text="Cancel").pack(side="right")
    ttk.Button(btn, text="Use selected tire").pack(side="right", padx=6)
    return d


# ------------------------------------------------------------------ Design A
def build_a(root):
    root.title("Auto Spiffer")
    root.geometry("1100x740+40+20")
    header(root)
    nb = ttk.Notebook(root)
    nb.pack(fill="both", expand=True, padx=8, pady=(0, 8))
    pages = [("  1  Inputs  ", page_inputs), ("  2  Review  ", page_review),
             ("  3  Run  ", page_run), ("  Tire List  ", page_tires)]
    for title, builder in pages:
        nb.add(builder(nb), text=title)
    st = ttk.Label(root, text="  Workspace: data\\months\\2026-09", relief="sunken", anchor="w")
    st.pack(fill="x", side="bottom")
    return nb


# ------------------------------------------------------------------ Design B
class Sidebar:
    def __init__(self, root):
        root.title("Auto Spiffer")
        root.geometry("1260x700+40+20")
        side = tk.Frame(root, bg="#26384a", width=190)
        side.pack(side="left", fill="y")
        side.pack_propagate(False)
        tk.Label(side, text="Auto Spiffer", bg="#26384a", fg="white",
                 font=("Segoe UI", 15, "bold"), pady=14).pack(fill="x")
        tk.Label(side, text="September 2026", bg="#26384a", fg="#9db4c8", anchor="w", padx=14).pack(fill="x")
        tk.Label(side, text="", bg="#26384a").pack()
        self.items = {}
        for key, text in (("inputs", "1   Load files"), ("review", "2   Review"),
                          ("run", "3   Run"), ("tires", "Tire list")):
            lb = tk.Label(side, text=text, bg="#26384a", fg="white", anchor="w", padx=18, pady=10,
                          font=("Segoe UI", 11))
            lb.pack(fill="x")
            self.items[key] = lb
        tk.Label(side, bg="#26384a").pack(expand=True, fill="both")
        tk.Label(side, text="Settings", bg="#26384a", fg="#9db4c8", anchor="w", padx=18, pady=10).pack(fill="x")
        self.main = ttk.Frame(root)
        self.main.pack(side="left", fill="both", expand=True)
        self.current = None

    def show(self, key):
        for k, lb in self.items.items():
            lb.configure(bg="#3b5873" if k == key else "#26384a")
        if self.current:
            self.current.destroy()
        self.current = {"review": dash_review, "run": dash_run}[key](self.main)
        self.current.pack(fill="both", expand=True)


def card(parent, number, label, color):
    c = tk.Frame(parent, bg="white", highlightbackground="#d0d0d0", highlightthickness=1, padx=16, pady=8)
    tk.Label(c, text=number, bg="white", fg=color, font=("Segoe UI", 22, "bold")).pack(anchor="w")
    tk.Label(c, text=label, bg="white", fg="#555555").pack(anchor="w")
    return c


def dash_review(parent):
    f = ttk.Frame(parent, padding=14)
    ttk.Label(f, text="Review", font=("Segoe UI", 14, "bold")).pack(anchor="w")
    ttk.Label(f, text="Check the matches. Rows in amber need one click from you before anything is typed.",
              foreground="#555555").pack(anchor="w", pady=(0, 8))
    cards = ttk.Frame(f)
    cards.pack(fill="x", pady=(0, 10))
    for n, l, c in (("17", "Ready", "#1b7a3a"), ("2", "Needs attention", "#b8860b"),
                    ("7", "Not eligible", "#777777"), ("1", "Problem", "#b00020"), ("62", "Tires to enter", "#1f4e79")):
        card(cards, n, l, c).pack(side="left", padx=(0, 10))
    frame, tree = review_tree(f, height=12)
    frame.pack(fill="both", expand=True)
    tree.selection_set(tree.get_children()[10])
    foot = ttk.Frame(f)
    foot.pack(fill="x", pady=(10, 0))
    ttk.Button(foot, text="Fix selected...").pack(side="left")
    ttk.Button(foot, text="Exclude row").pack(side="left", padx=6)
    ttk.Button(foot, text="Export CSV").pack(side="left")
    ttk.Button(foot, text="Continue to Run  \u25b6", state="disabled").pack(side="right")
    return f


def dash_run(parent):
    f = ttk.Frame(parent, padding=14)
    ttk.Label(f, text="Run", font=("Segoe UI", 14, "bold")).pack(anchor="w")
    ttk.Label(f, text="Open the claim site, log in, go to \u201cSubmit a Sales Claim\u201d, then start.",
              foreground="#555555").pack(anchor="w", pady=(0, 10))
    row = ttk.Frame(f)
    row.pack(fill="x")
    ttk.Button(row, text="1  Open claim site").pack(side="left")
    ttk.Button(row, text="2  I'm on the page, start").pack(side="left", padx=8)
    ttk.Button(row, text="Pause").pack(side="left")
    ttk.Button(row, text="Stop").pack(side="left", padx=8)

    big = ttk.Frame(f)
    big.pack(fill="x", pady=16)
    ttk.Label(big, text="12 of 27 sales", font=("Segoe UI", 20, "bold")).pack(anchor="w")
    ttk.Progressbar(big, maximum=100, value=44).pack(fill="x", pady=6)
    ttk.Label(big, text="Now: 214659  Continental SecureContact AW  x4  entering...", foreground="#1f4e79").pack(anchor="w")

    lg = ttk.LabelFrame(f, text=" Log ", padding=6)
    lg.pack(fill="both", expand=True)
    log_box(lg, height=12).pack(fill="both", expand=True)
    tk.Label(f, text="Nothing has been submitted. Review the page when finished, then submit it yourself.",
             bg="#e8f1fb", fg="#1f4e79", anchor="w", padx=10, pady=6).pack(fill="x", pady=(8, 0))
    return f


# ------------------------------------------------------------------- screenshots
def grab(root, path):
    from PIL import ImageGrab
    root.update_idletasks()
    root.update()
    x, y = root.winfo_rootx(), root.winfo_rooty()
    w, h = root.winfo_width(), root.winfo_height()
    ImageGrab.grab(bbox=(x, y, x + w, y + h)).save(path)


def run_shots(design, out):
    os.makedirs(out, exist_ok=True)
    root = tk.Tk()
    try:
        ttk.Style().theme_use("vista")
    except tk.TclError:
        pass
    if design == "A":
        nb = build_a(root)
        for i, name in enumerate(("inputs", "review", "run", "tires")):
            nb.select(i)
            root.update()
            root.after(300)
            grab(root, os.path.join(out, f"A_{i + 1}_{name}.png"))
        nb.select(1)
        root.update()
        d = fix_dialog(root)
        root.update()
        root.after(300)
        d.update()
        grab(root, os.path.join(out, "A_5_fix_dialog.png"))
    else:
        sb = Sidebar(root)
        for key in ("review", "run"):
            sb.show(key)
            root.update()
            root.after(300)
            grab(root, os.path.join(out, f"B_{key}.png"))
    root.destroy()


if __name__ == "__main__":
    design = (sys.argv[1] if len(sys.argv) > 1 else "A").upper()
    if "--shots" in sys.argv:
        run_shots(design, sys.argv[sys.argv.index("--shots") + 1])
        sys.exit()
    root = tk.Tk()
    try:
        ttk.Style().theme_use("vista")
    except tk.TclError:
        pass
    if design == "A":
        build_a(root)
    else:
        Sidebar(root).show("review")
    root.mainloop()
