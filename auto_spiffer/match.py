"""Match one report tire description (a TireSpec) to a tire on the ClaimForm list.

The report and the ClaimForm word a tire differently, and the report's word order varies, so
this works backwards from the list: "which tire on the list is best explained by these words?"

Tiers, stopping at the first confident one:
  1. saved   - the person already decided this wording (product_map.json)
  2. exact   - the model words, squeezed together, equal a list model ("AltiMAX RT45" = "Altimax RT45")
  3. tokens  - order-independent word matching with strict rules for identity tokens

Identity tokens decide WHICH tire it is: anything with a digit (RT45, G3, 7), roman numerals
(II, III), and short letter codes (HT, AT, AS, RS). They must match exactly in both directions,
so RT43 is never accepted for RT45, and "ONE" is never accepted for "One HT" without a person
looking. Longer descriptive words (ALTIMAX, TRAILER) may match with a small spelling difference
or be missing from the report.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from rapidfuzz import fuzz

from auto_spiffer.catalog import Catalog, compact_key
from auto_spiffer.models import CatalogItem
from auto_spiffer.product_map import ProductMap
from auto_spiffer.tirespec import TireSpec

READY_MIN_COVERAGE = 0.5   # at least half of the list tire's name must be found
READY_MIN_LEAD = 15.0      # and it must beat the runner-up by this many points
CREDIBLE_SCORE = 50.0      # below this nothing on the list is a believable match
SUGGESTION_MIN = 25.0      # suggestions shown to the person start here
FUZZY_MIN = 88             # spelling tolerance for descriptive words (percent)

READY, ATTENTION, NOT_ELIGIBLE = "ready", "attention", "not_eligible"


@dataclass
class MatchResult:
    status: str                       # ready, attention, not_eligible
    item: Optional[CatalogItem] = None  # the tire (ready) or the best guess (attention)
    tier: str = ""                    # saved, exact, tokens, or "" when nothing matched
    score: float = 0.0
    candidates: list[tuple[CatalogItem, float]] = field(default_factory=list)  # best three
    reason: str = ""
    notes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------- tokens
def _compact(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _tokens(text_or_words) -> list[tuple[str, str]]:
    """(original, compact) for each word, skipping words with no letters or digits."""
    words = text_or_words.split() if isinstance(text_or_words, str) else list(text_or_words)
    pairs = [(w, _compact(w)) for w in words]
    return [(o, c) for o, c in pairs if c]


def _is_identity(compact: str) -> bool:
    """Tokens that say which tire it is: has a digit, a roman numeral, or a short letter code."""
    return (any(ch.isdigit() for ch in compact)
            or bool(re.fullmatch(r"[ivx]{2,}", compact))
            or (compact.isalpha() and len(compact) <= 3))


# --------------------------------------------------------------------- analysis
@dataclass
class Analysis:
    item: CatalogItem
    score: float
    coverage: float                 # share of the list tire's name found in the description
    explained: float                # share of the description explained by the list tire
    missing: list[str]              # list tire words not found in the description
    unexplained: list[str]          # description words the list tire does not account for
    identity_missing: list[str]
    identity_extra: list[str]

    @property
    def code_mismatch(self) -> bool:
        return bool(self.identity_missing or self.identity_extra)


def _find(inv: list[str], target: str, used: set[int]) -> Optional[list[int]]:
    """Indexes of unused description words that spell the target: one word, or 2-3 adjacent words."""
    for i, word in enumerate(inv):
        if i not in used and word == target:
            return [i]
    for span in (2, 3):
        for i in range(len(inv) - span + 1):
            idxs = list(range(i, i + span))
            if not any(j in used for j in idxs) and "".join(inv[i:i + span]) == target:
                return idxs
    return None


def _find_fuzzy(inv: list[str], target: str, used: set[int]) -> Optional[int]:
    best, best_score = None, 0.0
    for i, word in enumerate(inv):
        if i in used or len(word) < 5 or _is_identity(word):
            continue
        score = fuzz.ratio(target, word)
        if score >= FUZZY_MIN and score > best_score:
            best, best_score = i, score
    return best


def analyze(item: CatalogItem, description: list[tuple[str, str]]) -> Analysis:
    """How well do the description's words explain this list tire? Order does not matter."""
    cand = _tokens(item.model)
    inv_orig = [o for o, _ in description]
    inv = [c for _, c in description]
    used: set[int] = set()
    matched: list[str] = []
    missing: list[tuple[str, str]] = []

    k = 0
    while k < len(cand):
        # Two or three list words written as one word in the description ("TerrainContact").
        run_found = False
        for span in (3, 2):
            if k + span <= len(cand):
                joined = "".join(c for _, c in cand[k:k + span])
                idxs = _find(inv, joined, used)
                if idxs:
                    used.update(idxs)
                    matched.extend(c for _, c in cand[k:k + span])
                    k += span
                    run_found = True
                    break
        if run_found:
            continue
        orig, comp = cand[k]
        idxs = _find(inv, comp, used)
        if idxs:
            used.update(idxs)
            matched.append(comp)
        elif not _is_identity(comp) and len(comp) >= 5 and (idx := _find_fuzzy(inv, comp, used)) is not None:
            used.add(idx)
            matched.append(comp)
        else:
            missing.append((orig, comp))
        k += 1

    cand_chars = sum(len(c) for _, c in cand) or 1
    inv_chars = sum(len(c) for c in inv) or 1
    coverage = sum(len(c) for c in matched) / cand_chars
    explained = sum(len(inv[i]) for i in used) / inv_chars
    score = 0.0 if coverage + explained == 0 else 100 * 2 * coverage * explained / (coverage + explained)

    unexplained = [inv_orig[i] for i in range(len(inv)) if i not in used]
    return Analysis(
        item=item, score=score, coverage=coverage, explained=explained,
        missing=[o for o, _ in missing],
        unexplained=unexplained,
        identity_missing=[o for o, c in missing if _is_identity(c)],
        identity_extra=[w for w in unexplained if _is_identity(_compact(w))],
    )


def _reason(a: Analysis, runner_up: Optional[Analysis]) -> str:
    parts = []
    if a.identity_missing:
        parts.append("the list tire has " + ", ".join(a.identity_missing) + " which the report line does not")
    if a.identity_extra:
        parts.append("the report line has " + ", ".join(a.identity_extra) + " which the list tire does not")
    other = [w for w in a.unexplained if w not in a.identity_extra]
    if other:
        parts.append("extra words in the report line: " + " ".join(other))
    if a.coverage < READY_MIN_COVERAGE:
        parts.append("only part of the tire name was found")
    if runner_up is not None and not parts:
        parts.append(f"{runner_up.item.site_text} is almost as close")
    return "; ".join(parts)


# ---------------------------------------------------------------------- matching
def match_tire(spec: TireSpec, catalog: Catalog,
               product_map: Optional[ProductMap] = None) -> MatchResult:
    notes: list[str] = []

    # Tier 1: a decision the person already made.
    if product_map is not None:
        entry = product_map.get(spec)
        if entry is not None:
            if entry.skip:
                return MatchResult(NOT_ELIGIBLE, tier="saved", score=100.0,
                                   reason="you marked this wording as not eligible")
            saved = catalog.by_id().get(entry.item_id)
            if saved is not None:
                return MatchResult(READY, saved, "saved", 100.0, reason="your saved choice")
            notes.append(f"a saved choice ({entry.item_id}) is no longer on the tire list, ignored")

    brand = spec.brand
    if brand is not None and not brand.on_claimform:
        return MatchResult(NOT_ELIGIBLE, reason=f"{brand.name} is not on the ClaimForm", notes=notes)

    tires = catalog.tires
    if brand is not None:
        pool = [t for t in tires if t.brand.lower() == brand.name.lower()]
        if not pool:
            return MatchResult(NOT_ELIGIBLE, reason=f"no {brand.name} tires on the ClaimForm", notes=notes)
    elif spec.brand_candidates:
        names = {b.name.lower() for b in spec.brand_candidates}
        pool = [t for t in tires if t.brand.lower() in names]
    else:
        pool = tires
    brand_known = brand is not None

    description = _tokens(spec.words)
    if not description:
        return MatchResult(NOT_ELIGIBLE, reason="no model words left in the report line", notes=notes)
    inv_key = "".join(c for _, c in description)

    # Tier 2: the model words squeezed together equal a list model.
    exact = [t for t in pool if compact_key(t.model) == inv_key]
    if len(exact) == 1:
        return MatchResult(READY, exact[0], "exact", 100.0, reason="same name", notes=notes)
    if len(exact) > 1:
        return MatchResult(ATTENTION, exact[0], "exact", 100.0,
                           candidates=[(t, 100.0) for t in exact[:3]],
                           reason="the name matches more than one tire (more than one brand?)",
                           notes=notes)

    # Tier 3: order-independent word matching.
    analyses = sorted((analyze(t, description) for t in pool),
                      key=lambda a: (-a.score, len(a.missing), a.item.site_text))
    best = analyses[0]
    runner = analyses[1] if len(analyses) > 1 else None
    candidates = [(a.item, round(a.score, 1)) for a in analyses if a.score >= SUGGESTION_MIN][:3]

    if best.score < CREDIBLE_SCORE:
        who = brand.name if brand else "any brand"
        return MatchResult(NOT_ELIGIBLE, candidates=candidates, score=best.score,
                           reason=f"nothing on the ClaimForm for {who} matches '{' '.join(spec.words)}'",
                           notes=notes)

    lead = best.score - (runner.score if runner else 0.0)
    confident = (brand_known and not best.code_mismatch and not best.unexplained
                 and best.coverage >= READY_MIN_COVERAGE and lead >= READY_MIN_LEAD)
    if confident:
        return MatchResult(READY, best.item, "tokens", round(best.score, 1),
                           candidates=candidates, reason="all identifying words match", notes=notes)

    reason = _reason(best, runner if lead < READY_MIN_LEAD else None)
    if not brand_known:
        reason = ("the brand was not recognized; " + reason).rstrip("; ")
    return MatchResult(ATTENTION, best.item, "tokens", round(best.score, 1),
                       candidates=candidates, reason=reason, notes=notes)
