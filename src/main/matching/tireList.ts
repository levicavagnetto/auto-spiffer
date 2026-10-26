import { brandForWord } from './brands'

export type Tire = {
  label: string
  brand: string
  model: string
  category: string | null
  kind: 'tire' | 'wheel'
}

function titleWords(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word && word !== 'tires')
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ')
}

export function parseTireList(labels: string[]): Tire[] {
  return labels.map((raw) => {
    const label = raw.trim()
    const split = label.lastIndexOf(' - ')
    const name = split < 0 ? label : label.slice(0, split)
    const category = split < 0 ? null : titleWords(label.slice(split + 3))
    const first = name.split(/\s+/)[0] ?? ''
    const brand = brandForWord(first) ?? first
    const kind = split < 0 && /\bWheels?$/i.test(name) ? 'wheel' : 'tire'
    return {
      label,
      brand,
      model: name.slice(first.length).trim(),
      category,
      kind
    }
  })
}
