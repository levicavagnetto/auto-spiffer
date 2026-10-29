const metric =
  '(?:LT|ST|P)?\\d{3}/\\d{2}\\s?Z?R\\s?\\d{2}(?:XL|LT)?(?:/\\d{1,2})?'
const flotation =
  '(?:LT)?\\d{2}\\s?X\\s?\\d{1,2}(?:\\.\\d{1,2})?\\s?R\\s?\\d{2}(?:LT)?(?:/\\d{1,2})?'
const bias =
  '\\d{1,2}X\\d{1,2}(?:\\.\\d{1,2})?(?:/\\d{1,2}(?:\\.\\d{1,2})?)?-\\d{1,2}'

export const tireSizePattern = new RegExp(
  `(?<![\\w/])(?:${metric}|${flotation}|${bias})(?![\\w])`,
  'i'
)

export function hasTireSize(description: string): boolean {
  return tireSizePattern.test(description)
}
