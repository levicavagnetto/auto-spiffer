import type { Sale } from '../../shared/sales'
import type { ReviewLine } from '../../shared/review'
import { matchTire, type SavedChoices } from './match'
import { parseDescription } from './parse'
import type { Tire } from './tireList'
import { wheelSignature } from './wheel'

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
    const isWheel = sale.notATire === 'wheel'
    const signature =
      match?.signature ??
      (isWheel ? wheelSignature(sale.description) : `row|${sale.row}`)
    const onList = (label: string | null | undefined): boolean =>
      label === null || tires.some((item) => item.label === label)
    const ownDecision = Object.hasOwn(decisions, signature)
      ? decisions[signature]
      : undefined
    const savedWheel =
      isWheel && ownDecision === undefined && onList(saved[signature]?.label)
        ? saved[signature]!.label
        : undefined
    const wheelChoice = ownDecision !== undefined ? ownDecision : savedWheel
    const decision =
      isWheel && wheelChoice !== undefined && !onList(wheelChoice)
        ? undefined
        : ownDecision
    const status = isWheel
      ? wheelChoice === null
        ? 'not-eligible'
        : wheelChoice && onList(wheelChoice)
          ? 'ready'
          : 'possible-wheel'
      : sale.notATire
        ? 'not-a-tire'
        : decision === null
          ? 'not-eligible'
          : decision
            ? 'ready'
            : match!.status
    const tire = isWheel
      ? status === 'ready'
        ? wheelChoice
        : undefined
      : (decision ?? match?.tire)
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
        : isWheel
          ? wheelChoice === null
            ? 'You marked this as not eligible.'
            : status === 'ready'
              ? savedWheel !== undefined
                ? 'Your saved match.'
                : 'Your choice for this month.'
              : tires.some((item) => item.kind === 'wheel')
                ? 'Possible wheel. Open it and choose the wheel product.'
                : "This month's claim page has no wheel products, so wheels can't be entered."
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
      savedMatch: isWheel
        ? savedWheel !== undefined && status === 'ready'
        : decision === undefined && (match?.savedMatch ?? false),
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
