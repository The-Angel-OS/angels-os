/**
 * ExecutionTrace — a processing context that records its own breadcrumb.
 *
 * The "processing unit" half of the processor-pipeline pattern: as a multi-step
 * operation runs (a LEO tool chain, a provisioning sequence, an order/return
 * processor), each step is recorded here. On failure the trace tells you exactly
 * how it got there — `research ✓ → provision ✓ → create_page ✗ (reason)` — instead
 * of a single opaque catch. Render it into `logError`'s `details` and the whole
 * chain rides the ApplicationLogs + AI-Bus + escalation pipeline.
 *
 * Pure + deterministic: pass a `now()` clock for stable timings in tests.
 *
 * @example
 * const trace = new ExecutionTrace('leo-toolchain')
 * const step = trace.begin('query_products', { round: 0 })
 * try { ... ; trace.end(step, 'ok', { meta: { bytes } }) }
 * catch (e) { trace.end(step, 'fail', { error: String(e) }); throw e }
 * if (trace.failed) log.error('tool chain failed', { details: trace.render() })
 */
export type StepStatus = 'ok' | 'fail' | 'skip'

export interface TraceStep {
  /** Order in which this step started (0-based). */
  index: number
  /** Step name (e.g. the tool name or pipeline stage). */
  name: string
  status: StepStatus
  /** Duration in ms (set on end). */
  ms?: number
  /** Short human note about the outcome. */
  detail?: string
  /** Error message when status === 'fail'. */
  error?: string
  /** Arbitrary structured context (redacted input, result size, round index…). */
  meta?: Record<string, unknown>
}

/** Opaque handle returned by begin(), passed back to end(). */
export interface StepHandle {
  readonly index: number
  readonly startedAt: number
}

export interface EndInfo {
  detail?: string
  error?: string
  meta?: Record<string, unknown>
}

export class ExecutionTrace {
  readonly source: string
  readonly steps: TraceStep[] = []
  private readonly now: () => number
  private seq = 0

  constructor(source: string, now: () => number = Date.now) {
    this.source = source
    this.now = now
  }

  /** Start a step; returns a handle to pass to end(). */
  begin(name: string, meta?: Record<string, unknown>): StepHandle {
    const index = this.seq++
    this.steps.push({ index, name, status: 'ok', meta })
    return { index, startedAt: this.now() }
  }

  /** Close a previously-begun step with its outcome. */
  end(handle: StepHandle, status: StepStatus, info: EndInfo = {}): void {
    const step = this.steps[handle.index]
    if (!step) return
    step.status = status
    step.ms = Math.max(0, this.now() - handle.startedAt)
    if (info.detail !== undefined) step.detail = info.detail
    if (info.error !== undefined) step.error = info.error
    if (info.meta) step.meta = { ...step.meta, ...info.meta }
  }

  /** Record a step that was skipped (never ran). */
  skip(name: string, detail?: string, meta?: Record<string, unknown>): void {
    this.steps.push({ index: this.seq++, name, status: 'skip', detail, meta })
  }

  /**
   * Run an async fn as a single traced step: records ok on success, fail on throw
   * (and re-throws so control flow is unchanged). The ergonomic common case.
   */
  async run<T>(name: string, fn: () => Promise<T>, meta?: Record<string, unknown>): Promise<T> {
    const handle = this.begin(name, meta)
    try {
      const result = await fn()
      this.end(handle, 'ok')
      return result
    } catch (err) {
      this.end(handle, 'fail', { error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  }

  /** True if any step failed. */
  get failed(): boolean {
    return this.steps.some((s) => s.status === 'fail')
  }

  /** The first failed step, if any (the break point). */
  get failedStep(): TraceStep | undefined {
    return this.steps.find((s) => s.status === 'fail')
  }

  /** Human breadcrumb: "a ✓ → b ✓ → c ✗ (reason)". */
  render(): string {
    const icon: Record<StepStatus, string> = { ok: '✓', fail: '✗', skip: '·' }
    return this.steps
      .map((s) => {
        const ms = s.ms != null ? ` ${s.ms}ms` : ''
        const why = s.status === 'fail' && s.error ? ` (${s.error})` : ''
        return `${s.name} ${icon[s.status]}${ms}${why}`
      })
      .join(' → ')
  }

  /** Structured form for Message.metadata / log details. */
  toJSON(): { source: string; failed: boolean; steps: TraceStep[] } {
    return { source: this.source, failed: this.failed, steps: this.steps }
  }
}
