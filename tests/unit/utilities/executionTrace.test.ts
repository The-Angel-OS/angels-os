import { describe, it, expect } from 'vitest'
import { ExecutionTrace } from '@/utilities/executionTrace'

// Deterministic clock: advances 5ms per read.
function fakeClock(start = 1000, step = 5) {
  let t = start
  return () => {
    const v = t
    t += step
    return v
  }
}

describe('ExecutionTrace', () => {
  it('records ordered steps with status and timing', () => {
    const trace = new ExecutionTrace('test', fakeClock())
    const a = trace.begin('a')
    trace.end(a, 'ok')
    const b = trace.begin('b')
    trace.end(b, 'ok')

    expect(trace.steps.map((s) => s.name)).toEqual(['a', 'b'])
    expect(trace.steps.map((s) => s.status)).toEqual(['ok', 'ok'])
    expect(trace.steps[0].ms).toBe(5) // begin reads t, end reads t+5
    expect(trace.failed).toBe(false)
  })

  it('marks failure and exposes the break point', () => {
    const trace = new ExecutionTrace('test', fakeClock())
    trace.end(trace.begin('a'), 'ok')
    trace.end(trace.begin('b'), 'fail', { error: 'boom' })
    trace.end(trace.begin('c'), 'ok')

    expect(trace.failed).toBe(true)
    expect(trace.failedStep?.name).toBe('b')
    expect(trace.failedStep?.error).toBe('boom')
  })

  it('renders a human breadcrumb with the failure reason', () => {
    const trace = new ExecutionTrace('test', fakeClock())
    trace.end(trace.begin('research'), 'ok')
    trace.end(trace.begin('provision'), 'ok')
    trace.end(trace.begin('create_page'), 'fail', { error: 'missing column' })

    expect(trace.render()).toBe(
      'research ✓ 5ms → provision ✓ 5ms → create_page ✗ 5ms (missing column)',
    )
  })

  it('run() records ok on success and returns the value', async () => {
    const trace = new ExecutionTrace('test', fakeClock())
    const out = await trace.run('step', async () => 42)
    expect(out).toBe(42)
    expect(trace.steps[0]).toMatchObject({ name: 'step', status: 'ok' })
    expect(trace.failed).toBe(false)
  })

  it('run() records fail and re-throws so control flow is unchanged', async () => {
    const trace = new ExecutionTrace('test', fakeClock())
    await expect(
      trace.run('step', async () => {
        throw new Error('nope')
      }),
    ).rejects.toThrow('nope')
    expect(trace.failedStep?.name).toBe('step')
    expect(trace.failedStep?.error).toBe('nope')
  })

  it('skip() records a non-run step', () => {
    const trace = new ExecutionTrace('test', fakeClock())
    trace.skip('optional', 'feature off')
    expect(trace.steps[0]).toMatchObject({ name: 'optional', status: 'skip', detail: 'feature off' })
  })

  it('toJSON is structured for metadata/log details', () => {
    const trace = new ExecutionTrace('leo-toolchain', fakeClock())
    trace.end(trace.begin('a', { round: 0 }), 'ok', { meta: { bytes: 12 } })
    const json = trace.toJSON()
    expect(json.source).toBe('leo-toolchain')
    expect(json.failed).toBe(false)
    expect(json.steps[0].meta).toEqual({ round: 0, bytes: 12 })
  })
})
