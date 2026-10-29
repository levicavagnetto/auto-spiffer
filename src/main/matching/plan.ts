import type { Sale } from '../../shared/sales'
import type { ReviewLine } from '../../shared/review'
import { matchTire, type SavedChoices } from './match'
import { parseDescription } from './parse'
import type { Tire } from './tireList'

export function planLines(
  sales: Sale[],
  tires: Tire[],
  saved: SavedChoices,
  pdfs: Record<string, string>,
  decisions: Record<string, string | null>,
  leftOut: Set<string>,
  dates: [string | null, string | null]
): ReviewLine[] {
  const lines: ReviewLine[] = []
  const groups = new Map<string, ReviewLine>()
  for (const sale of sales) {
    const parsed = parseDescription(sale.description)
    const match = sale.notATire
      ? null
      : matchTire(sale.description, tires, saved)
    const signature = match?.signature ?? `row|${sale.row}`
    const decision = Object.hasOwn(decisions, signature)
      ? decisions[signature]
      : undefined
    const status = sale.notATire
      ? 'not-a-tire'
      : decision === null
        ? 'not-eligible'
        : decision
          ? 'ready'
          : match!.status
    const tire = decision ?? match?.tire
    const outside =
      status === 'ready' &&
      dates[0] &&
      dates[1] &&
      (sale.saleDate < dates[0] || sale.saleDate > dates[1])
    const finalStatus = outside ? 'outside-dates' : status
    const id = `${sale.invoice}|${sale.saleDate}|${signature}`
    const line: ReviewLine = {
      id,
      saleDate: sale.saleDate,
      invoice: sale.invoice,
      description: sale.description,
      qty: sale.qty,
      rows: [sale.row],
      status: finalStatus,
      tire: tire ?? undefined,
      guess: decision !== undefined ? undefined : match?.guess,
      suggestions: decision !== undefined ? [] : (match?.suggestions ?? []),
      reason: outside
        ? `Sale date ${sale.saleDate} is outside program dates ${dates[0]} to ${dates[1]}.`
        : sale.notATire
          ? sale.notATire === 'tube'
            ? 'Tube, not a tire.'
            : sale.notATire === 'shipping'
              ? 'Shipping or handling, not a tire.'
              : 'No tire size found.'
          : decision === null
            ? 'You marked this as not eligible.'
            : decision
              ? 'Your choice for this month.'
              : match!.reason,
      signature,
      savedMatch: decision === undefined && (match?.savedMatch ?? false),
      pdf: pdfs[sale.invoice],
      leftOut: leftOut.has(id),
      readAs: { brand: parsed.brand, sizes: parsed.sizes, words: parsed.words }
    }
    const key = `${line.invoice}|${line.saleDate}|${line.status}|${line.status === 'ready' || line.status === 'outside-dates' ? line.tire : line.signature}`
    const existing = groups.get(key)
    if (existing) {
      existing.qty += line.qty
      existing.rows.push(...line.rows)
      existing.leftOut ||= line.leftOut
    } else {
      groups.set(key, line)
      lines.push(line)
    }
  }
  return lines
}
