import { describe, it, expect, vi } from 'vitest'
import { createLogger } from '@/utilities/createLogger'
import type { LogErrorOptions } from '@/utilities/logError'

describe('createLogger', () => {
  it('binds source and maps level methods', async () => {
    const calls: LogErrorOptions[] = []
    const sink = vi.fn(async (o: LogErrorOptions) => void calls.push(o))
    const log = createLogger('bookingEngine', {}, sink)

    await log.error('boom')
    await log.warn('careful')
    await log.info('fyi')
    await log.debug('trace')

    expect(calls.map((c) => [c.level, c.source, c.message])).toEqual([
      ['error', 'bookingEngine', 'boom'],
      ['warning', 'bookingEngine', 'careful'], // warn → 'warning'
      ['info', 'bookingEngine', 'fyi'],
      ['debug', 'bookingEngine', 'trace'],
    ])
  })

  it('merges bound defaults under per-call extra (extra wins)', async () => {
    const sink = vi.fn<[LogErrorOptions], Promise<void>>(async () => {})
    const log = createLogger('engine', { tenantId: 7, statusCode: 500 }, sink)

    await log.error('x', { statusCode: 409, details: 'd' })

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'engine', tenantId: 7, statusCode: 409, details: 'd' }),
    )
  })

  it('caught() extracts message + stack from an Error', async () => {
    const sink = vi.fn<[LogErrorOptions], Promise<void>>(async () => {})
    const log = createLogger('engine', {}, sink)
    const err = new Error('kaboom')

    await log.caught(err)

    const opts = sink.mock.calls[0][0]
    expect(opts.message).toBe('kaboom')
    expect(opts.details).toContain('kaboom') // stack contains the message
    expect(opts.level).toBe('error')
  })

  it('child() binds additional defaults without mutating the parent', async () => {
    const sink = vi.fn<[LogErrorOptions], Promise<void>>(async () => {})
    const parent = createLogger('engine', { tenantId: 1 }, sink)
    const child = parent.child({ url: '/x' })

    await parent.info('p')
    await child.info('c')

    expect(sink.mock.calls[0][0]).not.toHaveProperty('url')
    expect(sink.mock.calls[1][0]).toMatchObject({ tenantId: 1, url: '/x' })
  })
})
