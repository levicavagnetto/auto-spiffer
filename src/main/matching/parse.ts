import { brandForWord, isEligibleBrand } from './brands'

const metric =
  '(?:LT|ST|P)?\\d{3}/\\d{2}\\s?Z?R\\s?\\d{2}(?:XL|LT)?(?:/\\d{1,2})?'
const flotation =
  '(?:LT)?\\d{2}\\s?X\\s?\\d{1,2}(?:\\.\\d{1,2})?\\s?R\\s?\\d{2}(?:LT)?(?:/\\d{1,2})?'
const bias =
  '\\d{1,2}X\\d{1,2}(?:\\.\\d{1,2})?(?:/\\d{1,2}(?:\\.\\d{1,2})?)?-\\d{1,2}'
const sizePattern = new RegExp(
  `(?<![\\w/])(?:${metric}|${flotation}|${bias})(?![\\w])`,
  'gi'
)
const warranty = /\(?(?<![\w/])\d{2,3}K(?![\w])\)?/gi
const rating = /(?<![\w/])\d{2,3}(?:\/\d{2,3})?[JLMNPQRSTUHVWY](?![\w/])/gi
const noise = new Set([
  'BW',
  'M',
  'XL',
  'RF',
  'SL',
  'OWL',
  'RWL',
  'WL',
  '3PMS',
  '3PMSF',
  'M+S',
  'M/S',
  'MS',
  'BLK'
])

export function compact(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export type ParsedDescription = {
  sizes: string[]
  loadSpeed: string[]
  warranties: string[]
  noise: string[]
  brand: string | null
  brandCandidates: string[]
  words: string[]
}

export function parseDescription(description: string): ParsedDescription {
  const sizes = description.match(sizePattern) ?? []
  const withoutSizes = description.replace(sizePattern, ' ')
  const warranties = withoutSizes.match(warranty) ?? []
  const withoutWarranties = withoutSizes.replace(warranty, ' ')
  const loadSpeed = withoutWarranties.match(rating) ?? []
  const remainder = withoutWarranties.replace(rating, ' ')
  const words = remainder
    .split(/\s+/)
    .map((word) => word.replace(/^[()[\],;:]+|[()[\],;:]+$/g, ''))
    .filter(Boolean)
  const isNoise = (word: string, index: number): boolean =>
    noise.has(word.toUpperCase()) ||
    /^\d{1,2}PR$/i.test(word) ||
    (/^[A-F](?:\/\d{1,2})?$/i.test(word) &&
      !(word.toUpperCase() === 'A' && words[index + 1]?.toUpperCase() === 'TX'))
  const discarded = words.filter(isNoise)
  const model = words.filter((word, index) => !isNoise(word, index))
  const candidates = [
    ...new Set(
      model.map(brandForWord).filter((brand): brand is string => Boolean(brand))
    )
  ]
  const outside = candidates.find((candidate) => !isEligibleBrand(candidate))
  const brand = outside ?? (candidates.length === 1 ? candidates[0]! : null)
  const brandCandidates = outside ? [outside] : candidates
  const modelWords = brand
    ? model.filter((word) => brandForWord(word) !== brand)
    : model
  return {
    sizes,
    loadSpeed,
    warranties,
    noise: discarded,
    brand,
    brandCandidates,
    words: modelWords
  }
}

export function wordingSignature(parsed: ParsedDescription): string {
  return `${parsed.brand?.toLowerCase() ?? '?'}|${compact(parsed.words.join(''))}`
}
