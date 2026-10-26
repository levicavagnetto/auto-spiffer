import { hasTireSize } from '../matching/sizes'
import type { NotATireReason, Sale } from '../../shared/sales'

export function classifySale(description: string): NotATireReason | null {
  if (/shipping|handling/i.test(description)) return 'shipping'
  if (/\btube\b/i.test(description)) return 'tube'
  if (!hasTireSize(description)) return 'no-size'
  return null
}

function monthLabel(month: string): string {
  const [year, number] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year!, number! - 1, 1)))
}

export function chooseMonth(sales: Sale[]): {
  month: string
  monthWarning?: string
} {
  const counts = new Map<string, number>()
  for (const sale of sales) {
    const month = sale.saleDate.slice(0, 7)
    counts.set(
      month,
      (counts.get(month) ?? 0) + (sale.notATire === null ? 1 : 0)
    )
  }
  if (counts.size === 0) return { month: '' }
  const ordered = [...counts].sort(
    ([monthA, countA], [monthB, countB]) =>
      countB - countA || monthA.localeCompare(monthB)
  )
  const month = ordered[0]![0]
  if (ordered.length === 1) return { month }
  const groups = [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${monthLabel(key)} (${count})`)
  return {
    month,
    monthWarning: `This file has tire sales from ${groups.join(' and ')}. Using ${monthLabel(month)}.`
  }
}
