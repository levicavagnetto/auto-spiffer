export class RunControl {
  private paused = false
  private stopped = false
  private waiters: Array<() => void> = []

  pause(): void {
    if (!this.stopped) this.paused = true
  }
  resume(): void {
    this.paused = false
    for (const wake of this.waiters.splice(0)) wake()
  }
  stop(): void {
    this.stopped = true
    this.resume()
  }
  get isPaused(): boolean {
    return this.paused
  }
  get isStopped(): boolean {
    return this.stopped
  }
  async checkpoint(): Promise<boolean> {
    while (this.paused && !this.stopped)
      await new Promise<void>((resolve) => this.waiters.push(resolve))
    return !this.stopped
  }
}
