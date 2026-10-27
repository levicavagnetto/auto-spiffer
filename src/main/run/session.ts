import type { ReviewSnapshot } from '../../shared/review'
import type { RunState } from '../../shared/run'
import type { SitePage } from '../site/driver'
import { checkPage } from './check-page'
import { RunControl } from './control'
import { runLines, type RunDriver, type RunEvent } from './runner'

type Dependencies = {
  review: () => ReviewSnapshot | null
  month: () => string | null
  readPage: () => Promise<SitePage | null>
  driver: RunDriver
  publish: (state: RunState) => void
  log?: (error: unknown) => void
  maxLines?: number
}

export class RunSession {
  private state: RunState = {
    phase: 'idle',
    check: null,
    summary: null,
    done: 0,
    total: 0,
    now: null,
    activity: []
  }
  private control: RunControl | null = null
  private task: Promise<void> | null = null
  constructor(private readonly deps: Dependencies) {}
  snapshot(): RunState {
    return structuredClone(this.state)
  }
  reset(): void {
    if (this.active)
      throw new Error('Wait for claim entry to finish before changing sales.')
    this.state = {
      phase: 'idle',
      check: null,
      summary: null,
      done: 0,
      total: 0,
      now: null,
      activity: []
    }
    this.publish()
  }
  get active(): boolean {
    return (
      this.state.phase === 'running' ||
      this.state.phase === 'paused' ||
      this.state.phase === 'checking'
    )
  }
  private publish(): RunState {
    const state = this.snapshot()
    this.deps.publish(state)
    return state
  }
  private candidates(): {
    month: string
    lines: NonNullable<ReturnType<Dependencies['review']>>['lines']
  } {
    const review = this.deps.review()
    const month = this.deps.month()
    if (!review || !month)
      throw new Error('Choose sales and match the tires first.')
    if (
      review.lines.some(
        (line) => line.status === 'needs-decision' && !line.leftOut
      )
    )
      throw new Error(
        'Decide every tire that needs a choice before entering sales.'
      )
    const lines = review.lines
      .filter((line) => line.status === 'ready' && !line.leftOut)
      .sort(
        (a, b) =>
          a.saleDate.localeCompare(b.saleDate) ||
          a.invoice.localeCompare(b.invoice)
      )
    return {
      month,
      lines: this.deps.maxLines ? lines.slice(0, this.deps.maxLines) : lines
    }
  }
  async check(): Promise<RunState> {
    if (this.active) throw new Error('A claim run is already in progress.')
    const { month, lines } = this.candidates()
    this.state = {
      phase: 'checking',
      check: null,
      summary: null,
      done: 0,
      total: lines.length,
      now: null,
      activity: []
    }
    this.publish()
    try {
      this.state.check = checkPage(await this.deps.readPage(), month, lines)
      this.state.phase = 'idle'
      return this.publish()
    } catch (error) {
      this.deps.log?.(error)
      this.state.phase = 'idle'
      this.publish()
      throw new Error(
        'Could not read the claim page. Reload it and try again.',
        { cause: error }
      )
    }
  }
  async start(): Promise<RunState> {
    if (this.active) throw new Error('A claim run is already in progress.')
    const { month, lines } = this.candidates()
    this.state.phase = 'checking'
    this.publish()
    try {
      this.state.check = checkPage(await this.deps.readPage(), month, lines)
    } catch (error) {
      this.deps.log?.(error)
      this.state.phase = 'idle'
      this.publish()
      throw new Error(
        'Could not read the claim page. Reload it and try again.',
        { cause: error }
      )
    }
    if (!this.state.check.ok) {
      this.state.phase = 'idle'
      return this.publish()
    }
    this.control = new RunControl()
    this.state = {
      phase: 'running',
      check: this.state.check,
      summary: null,
      done: 0,
      total: lines.length,
      now: null,
      activity: []
    }
    this.task = runLines(lines, this.deps.driver, this.control, (event) =>
      this.onEvent(event)
    )
      .then(() => undefined)
      .catch((error: unknown) => {
        this.state.activity.unshift({
          lineId: '',
          kind: 'failed',
          text: error instanceof Error ? error.message : String(error)
        })
        this.state.phase = 'finished'
        this.publish()
      })
    return this.publish()
  }
  private onEvent(event: RunEvent): void {
    if (event.type === 'progress') {
      this.state.done = event.done
      this.state.total = event.total
    }
    if (event.type === 'now') this.state.now = event.lineId
    if (event.type === 'activity')
      this.state.activity.unshift({
        lineId: event.lineId,
        kind: event.kind,
        text: event.text
      })
    if (event.type === 'finished') {
      this.state.summary = event.summary
      this.state.phase = 'finished'
      this.state.now = null
      this.control = null
    }
    this.publish()
  }
  pause(): RunState {
    if (this.state.phase !== 'running')
      throw new Error('No claim run is entering sales.')
    this.control!.pause()
    this.state.phase = 'paused'
    return this.publish()
  }
  resume(): RunState {
    if (this.state.phase !== 'paused')
      throw new Error('The claim run is not paused.')
    this.control!.resume()
    this.state.phase = 'running'
    return this.publish()
  }
  stop(): RunState {
    if (!this.active || !this.control)
      throw new Error('No claim run is entering sales.')
    this.control.stop()
    return this.publish()
  }
  async stopAndWait(): Promise<void> {
    if (this.control) this.control.stop()
    await this.task
  }
}
