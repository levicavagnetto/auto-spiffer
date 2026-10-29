import { isEligibleBrand } from './brands'
import { compact, parseDescription, wordingSignature } from './parse'
import { similarity } from './similarity'
import type { Tire } from './tireList'

export type SavedChoice = {
  label: string | null
  example: string
  decidedOn: string
}
export type SavedChoices = Record<string, SavedChoice>
export type Suggestion = { label: string; score: number; reason: string }
export type MatchResult = {
  status: 'ready' | 'needs-decision' | 'not-eligible'
  tire?: string
  guess?: string
  suggestions: Suggestion[]
  reason: string
  savedMatch: boolean
  signature: string
}

function identity(word: string): boolean {
  const value = compact(word)
  return /\d/.test(value) || /^[ivx]{2,}$/.test(value) || value.length <= 3
}

type Scored = {
  tire: Tire
  score: number
  coverage: number
  missing: string[]
  extra: string[]
  identityMissing: string[]
  identityExtra: string[]
}

function scoreTire(tire: Tire, descriptionWords: string[]): Scored {
  const target = tire.model.split(/\s+/).filter(Boolean)
  const source = descriptionWords.map(compact)
  const used = new Set<number>()
  const missing: string[] = []
  let matched = 0
  for (let i = 0; i < target.length;) {
    let found = false
    for (
      let count = Math.min(3, target.length - i);
      count >= 1 && !found;
      count--
    ) {
      const group = target.slice(i, i + count)
      const wanted = compact(group.join(''))
      for (let start = 0; start < source.length && !found; start++) {
        for (let span = 1; span <= 3 && start + span <= source.length; span++) {
          const indexes = Array.from(
            { length: span },
            (_, offset) => start + offset
          )
          if (indexes.some((index) => used.has(index))) continue
          if (source.slice(start, start + span).join('') !== wanted) continue
          indexes.forEach((index) => used.add(index))
          matched += group.reduce((sum, word) => sum + compact(word).length, 0)
          i += count
          found = true
          break
        }
      }
    }
    if (found) continue
    const word = target[i]!
    const wanted = compact(word)
    if (!identity(word) && wanted.length >= 5) {
      let best = -1
      let ratio = 0
      for (let index = 0; index < source.length; index++) {
        if (
          used.has(index) ||
          identity(descriptionWords[index]!) ||
          source[index]!.length < 5
        )
          continue
        const next = similarity(wanted, source[index]!)
        if (next > ratio) {
          best = index
          ratio = next
        }
      }
      if (best >= 0 && ratio >= 88) {
        used.add(best)
        matched += wanted.length
        i++
        continue
      }
    }
    missing.push(word)
    i++
  }
  const totalTarget = target.reduce(
    (sum, word) => sum + compact(word).length,
    0
  )
  const totalSource = source.reduce((sum, word) => sum + word.length, 0)
  const usedChars = source.reduce(
    (sum, word, index) => sum + (used.has(index) ? word.length : 0),
    0
  )
  const coverage = totalTarget ? matched / totalTarget : 0
  const explained = totalSource ? usedChars / totalSource : 0
  const score =
    coverage + explained
      ? (200 * coverage * explained) / (coverage + explained)
      : 0
  const extra = descriptionWords.filter((_, index) => !used.has(index))
  return {
    tire,
    score,
    coverage,
    missing,
    extra,
    identityMissing: missing.filter(identity),
    identityExtra: extra.filter(identity)
  }
}

export function matchTire(
  description: string,
  tires: Tire[],
  saved: SavedChoices = {}
): MatchResult {
  const parsed = parseDescription(description)
  const signature = wordingSignature(parsed)
  const base = { signature, suggestions: [] as Suggestion[], savedMatch: false }
  const choice = saved[signature]
  if (
    choice &&
    (choice.label === null ||
      tires.some((item) => item.kind === 'tire' && item.label === choice.label))
  ) {
    if (choice.label === null)
      return {
        ...base,
        status: 'not-eligible',
        reason: 'You marked this as not eligible.',
        savedMatch: true
      }
    return {
      ...base,
      status: 'ready',
      tire: choice.label,
      reason: 'Your saved match.',
      savedMatch: true
    }
  }
  if (parsed.brand && !isEligibleBrand(parsed.brand)) {
    return {
      ...base,
      status: 'not-eligible',
      reason: `${parsed.brand} is not on the claim page.`
    }
  }
  const available = tires.filter((item) => item.kind === 'tire')
  const brands = parsed.brand ? [parsed.brand] : parsed.brandCandidates
  const pool = brands.length
    ? available.filter((item) => brands.includes(item.brand))
    : available
  if (!pool.length || !parsed.words.length) {
    return {
      ...base,
      status: 'not-eligible',
      reason: parsed.brand
        ? `Nothing on the claim page for ${parsed.brand} matches this tire.`
        : 'No tire name was found in this report line.'
    }
  }
  const exact = pool.filter(
    (item) => compact(item.model) === compact(parsed.words.join(''))
  )
  if (exact.length === 1)
    return {
      ...base,
      status: 'ready',
      tire: exact[0]!.label,
      reason: 'Exact tire name.'
    }
  if (exact.length > 1)
    return {
      ...base,
      status: 'needs-decision',
      guess: exact[0]!.label,
      suggestions: exact.slice(0, 3).map((item) => ({
        label: item.label,
        score: 100,
        reason: 'The name matches more than one tire.'
      })),
      reason: 'The name matches more than one tire.'
    }
  const ranked = pool
    .map((item) => scoreTire(item, parsed.words))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.missing.length - b.missing.length ||
        a.tire.label.localeCompare(b.tire.label)
    )
  const best = ranked[0]!
  const suggestions = ranked
    .filter((item) => item.score >= 25)
    .slice(0, 3)
    .map((item) => ({
      label: item.tire.label,
      score: Math.round(item.score),
      reason: item.missing.length
        ? `Missing ${item.missing.join(', ')}`
        : 'Closest name'
    }))
  if (best.score < 50) {
    const name = parsed.brand ?? parsed.words[0] ?? 'this tire'
    return {
      ...base,
      status: 'not-eligible',
      reason: parsed.brand
        ? `Nothing on the claim page for ${name} matches '${parsed.words.join(' ')}'.`
        : `${name} is not on the claim page.`,
      suggestions
    }
  }
  const second = ranked[1]
  const lead = best.score - (second?.score ?? 0)
  const confident =
    Boolean(parsed.brand) &&
    !best.identityMissing.length &&
    !best.identityExtra.length &&
    !best.extra.length &&
    best.coverage >= 0.5 &&
    lead >= 15
  if (confident)
    return {
      ...base,
      status: 'ready',
      tire: best.tire.label,
      reason: 'Matched the tire name.',
      suggestions
    }
  const reason = !parsed.brand
    ? 'The brand was not recognized.'
    : best.identityMissing.length && best.identityExtra.length
      ? `The report line has ${best.identityExtra.join(', ')} but the list tire has ${best.identityMissing.join(', ')}.`
      : best.identityMissing.length
        ? `The list tire has ${best.identityMissing.join(', ')} which the report line does not.`
        : best.identityExtra.length
          ? `The report line has ${best.identityExtra.join(', ')} which the list tire does not.`
          : best.extra.length
            ? `Extra words in the report line: ${best.extra.join(', ')}.`
            : best.coverage < 0.5
              ? 'Only part of the tire name was found.'
              : lead < 15
                ? `${second?.tire.model ?? 'Another tire'} is almost as close.`
                : 'The tire name needs a closer look.'
  return {
    ...base,
    status: 'needs-decision',
    guess: best.tire.label,
    reason,
    suggestions
  }
}
