import type { SitePage } from '../site/driver'
import type { SalesSnapshot } from '../../shared/sales'
import type { ReviewSnapshot } from '../../shared/review'
import type { SavedMatchesAccess } from './saved-matches'
import { parseTireList } from './tireList'
import { planLines } from './plan'

function monthName(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`)
  return Number.isNaN(date.getTime())
    ? 'this month'
    : new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(date)
}
function dateOnly(date: Date | null): string | null {
  return date?.toISOString().slice(0, 10) ?? null
}

export class ReviewSession {
  private page: SitePage | null = null
  private decisions: Record<string, string | null> = {}
  private leftOut = new Set<string>()

  constructor(
    private readonly sales: () => SalesSnapshot | null,
    private readonly readPage: () => Promise<SitePage | null>,
    private readonly saved: SavedMatchesAccess
  ) {}

  reset(): void {
    this.page = null
    this.decisions = {}
    this.leftOut.clear()
  }

  async match(): Promise<ReviewSnapshot> {
    const snapshot = this.sales()
    if (!snapshot) throw new Error('Choose a Material Sales export first.')
    const page = await this.readPage()
    if (!page || !page.tires.length)
      throw new Error(
        `Open the claim page for ${monthName(snapshot.state.month)} in the ProRewards tab first.`
      )
    this.page = page
    return this.snapshot()!
  }

  snapshot(): ReviewSnapshot | null {
    const sales = this.sales()
    if (!sales || !this.page) return null
    const tires = parseTireList(this.page.tires)
    const dates: [string | null, string | null] = [
      dateOnly(this.page.window[0]),
      dateOnly(this.page.window[1])
    ]
    return {
      lines: planLines(
        sales.state.sales,
        tires,
        this.saved.read(),
        sales.links.usedByInvoice,
        this.decisions,
        this.leftOut,
        dates
      ),
      tires,
      promotion: this.page.promotion,
      dates
    }
  }

  decide(input: {
    signature: string
    label: string | null
    remember: boolean
  }): ReviewSnapshot {
    const current = this.snapshot()
    if (!current) throw new Error('Match the tires first.')
    const line = current.lines.find(
      (item) => item.signature === input.signature
    )
    if (!line) throw new Error('That sale is no longer in the review.')
    if (line.status === 'not-a-tire' || line.status === 'possible-wheel')
      throw new Error('This line is not a tire.')
    if (
      input.label !== null &&
      !current.tires.some(
        (item) => item.kind === 'tire' && item.label === input.label
      )
    )
      throw new Error('Choose a tire on the current claim page list.')
    this.decisions[input.signature] = input.label
    if (input.remember)
      this.saved.set(input.signature, input.label, line.description)
    return this.snapshot()!
  }

  setLeftOut(input: { id: string; leftOut: boolean }): ReviewSnapshot {
    if (!this.snapshot()?.lines.some((line) => line.id === input.id))
      throw new Error('That sale is no longer in the review.')
    if (input.leftOut) this.leftOut.add(input.id)
    else this.leftOut.delete(input.id)
    return this.snapshot()!
  }

  savedMatches() {
    return this.saved.list(this.page?.tires ?? null)
  }
  removeSaved(signature: string): void {
    this.saved.remove(signature)
    delete this.decisions[signature]
  }
}
