export const eligibleBrands: Record<string, string> = {
  CON: 'Continental',
  FAL: 'Falken',
  GEN: 'General',
  HER: 'Hercules',
  NIT: 'Nitto',
  NOK: 'Nokian',
  TOY: 'Toyo',
  PIRELLI: 'Pirelli'
}

export const otherBrands: Record<string, string> = {
  CAR: 'Carlisle',
  FST: 'FST',
  IRON: 'Ironman'
}

const known = { ...eligibleBrands, ...otherBrands }
const fullNames = Object.values(known)

export function brandForWord(word: string): string | null {
  const upper = word.toUpperCase()
  return (
    known[upper] ??
    fullNames.find((name) => name.toUpperCase() === upper) ??
    null
  )
}

export function isEligibleBrand(brand: string): boolean {
  return Object.values(eligibleBrands).includes(brand)
}
