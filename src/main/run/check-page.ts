import type { SitePage } from '../site/driver'
import type { ReviewLine } from '../../shared/review'

export type PageCheck = {
  ok: boolean
  problems: string[]
  warnings: string[]
  program: string | null
  dates: [string | null, string | null]
}

function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`)
  return Number.isNaN(date.getTime())
    ? month
    : new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(date)
}
function day(date: Date | null): string | null {
  return date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : null
}

export function checkPage(
  page: SitePage | null,
  month: string,
  lines: ReviewLine[]
): PageCheck {
  const problems: string[] = []
  const warnings: string[] = []
  if (!page)
    return {
      ok: false,
      problems: [
        `Open the claim page for ${monthLabel(month)} in the ProRewards tab first.`
      ],
      warnings,
      program: null,
      dates: [null, null]
    }
  const program = page.promotion
  const dates: [string | null, string | null] = [
    day(page.window[0]),
    day(page.window[1])
  ]
  const wantedMonth = monthLabel(month)
  if (!program || !program.toLowerCase().includes(wantedMonth.toLowerCase())) {
    problems.push(
      `The claim page is for ${program ?? 'an unknown program'}. Open the ${wantedMonth} program.`
    )
  }
  if (!dates[0] || !dates[1])
    problems.push(
      'The claim page does not show program dates. Open the claim page again.'
    )
  else
    for (const line of lines)
      if (line.saleDate < dates[0] || line.saleDate > dates[1])
        problems.push(
          `Invoice ${line.invoice} is dated ${line.saleDate}, outside the program dates ${dates[0]} to ${dates[1]}.`
        )
  const products = new Set(page.tires)
  for (const tire of new Set(
    lines
      .map((line) => line.tire)
      .filter((item): item is string => Boolean(item))
  )) {
    if (!products.has(tire))
      problems.push(
        `${tire} is missing from the claim page tire list. Match the tires again.`
      )
  }
  if (!lines.length)
    problems.push('No sales are ready to enter. Review the sales first.')
  return { ok: problems.length === 0, problems, warnings, program, dates }
}
