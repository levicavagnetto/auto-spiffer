# Design

## Context

`classifySale` currently returns shipping, tube, or no-size; `planLines` turns all three into Not a tire. The Review filter uses the planned line status. The claim-page product parser already distinguishes wheel labels, while tire matching and the entry runner accept only tire products. See `proposal.md` for the user problem and the delta specs for required behavior.

## Goals / Non-Goals

**Goals:** Identify likely wheel rows in the import, preserve them in Review, and make manual action clear without changing tire entry.

**Non-Goals:** Determine Custom versus Steel, infer ProRewards eligibility, remember wheel decisions, or enter/upload wheel claims automatically.

## Decisions

1. Extend the existing sale classification with a `wheel` value and the Review line status with `possible-wheel`. This retains the existing sales and review data flow and keeps wheel rows outside the tire matcher and ready-line runner. A separate wheel matching pipeline would be disproportionate for display-only guidance.
2. Classify shipping/handling and tubes first. Recognize explicit Custom or Steel wheel product wording, or a wheel diameter-by-width dimension paired with wheel/rim wording or a bolt pattern such as `20X9` plus `8X165.1` or `20X10` plus `5X5.00`. A lone `20X9` or service wording such as "wheel alignment" is insufficient. Keep the rule case-insensitive and cover clearly named wheel products that also contain a tire-size-like token. Ambiguous rows remain in their current tire or Not a tire path.
3. Add a Wheels choice to Review's existing filter strip and table. Its rows use **Possible wheel** status, preserve invoice/date/description/quantity/PDF columns, and do not open the tire-choice sheet. The note reads: "These rows look like wheels. Check whether they qualify for ATD Custom Wheels or ATD Steel Wheels, then enter them on ProRewards yourself."
4. Keep wheel rows excluded from tire counts, missing tire-PDF warnings, saved tire matches, and the automatic run. Review can still show whether a PDF was linked, which helps the person prepare manual entry. No wheel data is persisted beyond the already transient sales/review state.

## Risks / Trade-offs

- A dimension pattern can resemble another product → require both wheel size and bolt pattern, keep the status tentative, and test tire/tube/shipping counterexamples.
- Other wheel description formats may remain Not a tire → keep detection conservative and extend it only with observed formats.
- The ProRewards wheel options do not prove that any imported wheel qualifies → the note explicitly asks for a manual eligibility check and does not choose an option.
