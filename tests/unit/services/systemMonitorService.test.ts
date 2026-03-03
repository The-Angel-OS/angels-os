/**
 * SystemMonitorService — Unit Tests
 *
 * Tests logApi (dev-only console.debug) and logError (always console.error).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { logApi, logError } from '@/services/SystemMonitorService'

// ── logApi ────────────────────────────────────────────────────────────────────

describe('logApi', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('calls console.debug in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    logApi('GET', '/api/test', 200, 55)
    expect(debugSpy).toHaveBeenCalledTimes(1)
  })

  it('debug message contains method, url, status, and duration', () => {
    vi.stubEnv('NODE_ENV', 'development')
    logApi('POST', '/api/orders', 201, 120)
    const msg = debugSpy.mock.calls[0][0] as string
    expect(msg).toContain('POST')
    expect(msg).toContain('/api/orders')
    expect(msg).toContain('201')
    expect(msg).toContain('120')
  })

  it('does NOT call console.debug in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    logApi('GET', '/api/test', 200, 10)
    expect(debugSpy).not.toHaveBeenCalled()
  })

  it('does NOT call console.debug in test environment', () => {
    // NODE_ENV=test is the default in vitest — no stub needed
    logApi('DELETE', '/api/user', 204, 5)
    expect(debugSpy).not.toHaveBeenCalled()
  })
})

// ── logError ──────────────────────────────────────────────────────────────────

describe('logError', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls console.error', () => {
    logError('Something failed', 'TestService')
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('message includes category in brackets', () => {
    logError('Oops', 'OrderService')
    const args = errorSpy.mock.calls[0]
    expect(args[0]).toContain('[OrderService]')
    expect(args[0]).toContain('Oops')
  })

  it('passes context as second argument when provided', () => {
    const ctx = { orderId: 42, userId: 7 }
    logError('Failed', 'PaymentService', ctx)
    const args = errorSpy.mock.calls[0]
    expect(args[1]).toEqual(ctx)
  })

  it('passes empty string when context is omitted', () => {
    logError('Error', 'Module')
    const args = errorSpy.mock.calls[0]
    expect(args[1]).toBe('')
  })
})
