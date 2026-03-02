import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  withRetry,
  isRetryableStatus,
  isRetryableError,
  calculateDelay,
} from '@/utilities/outboundRetry'

// ─── isRetryableStatus ───────────────────────────────────────

describe('isRetryableStatus', () => {
  it('retries 429 (rate limit)', () => {
    expect(isRetryableStatus(429)).toBe(true)
  })

  it('retries 500 (internal server error)', () => {
    expect(isRetryableStatus(500)).toBe(true)
  })

  it('retries 502 (bad gateway)', () => {
    expect(isRetryableStatus(502)).toBe(true)
  })

  it('retries 503 (service unavailable)', () => {
    expect(isRetryableStatus(503)).toBe(true)
  })

  it('retries 504 (gateway timeout)', () => {
    expect(isRetryableStatus(504)).toBe(true)
  })

  it('does NOT retry 400 (bad request)', () => {
    expect(isRetryableStatus(400)).toBe(false)
  })

  it('does NOT retry 401 (unauthorized)', () => {
    expect(isRetryableStatus(401)).toBe(false)
  })

  it('does NOT retry 403 (forbidden)', () => {
    expect(isRetryableStatus(403)).toBe(false)
  })

  it('does NOT retry 404 (not found)', () => {
    expect(isRetryableStatus(404)).toBe(false)
  })

  it('does NOT retry 200 (success)', () => {
    expect(isRetryableStatus(200)).toBe(false)
  })

  it('does NOT retry 422 (unprocessable entity)', () => {
    expect(isRetryableStatus(422)).toBe(false)
  })
})

// ─── isRetryableError ────────────────────────────────────────

describe('isRetryableError', () => {
  it('retries TypeError (fetch network failure)', () => {
    expect(isRetryableError(new TypeError('fetch failed'))).toBe(true)
  })

  it('retries ECONNRESET errors', () => {
    expect(isRetryableError(new Error('read ECONNRESET'))).toBe(true)
  })

  it('retries ECONNREFUSED errors', () => {
    expect(isRetryableError(new Error('connect ECONNREFUSED 127.0.0.1:443'))).toBe(true)
  })

  it('retries ETIMEDOUT errors', () => {
    expect(isRetryableError(new Error('connect ETIMEDOUT'))).toBe(true)
  })

  it('retries errors with HTTP 502 in message', () => {
    expect(isRetryableError(new Error('WhatsApp API 502: Bad Gateway'))).toBe(true)
  })

  it('retries errors with HTTP 503 in message', () => {
    expect(isRetryableError(new Error('Telegram API 503: Service Unavailable'))).toBe(true)
  })

  it('retries errors with HTTP 429 in message', () => {
    expect(isRetryableError(new Error('Twilio API 429: Too Many Requests'))).toBe(true)
  })

  it('retries rate limit keyword', () => {
    expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true)
  })

  it('does NOT retry errors with HTTP 400 in message', () => {
    expect(isRetryableError(new Error('WhatsApp API 400: Invalid parameter'))).toBe(false)
  })

  it('does NOT retry errors with HTTP 401 in message', () => {
    expect(isRetryableError(new Error('Telegram API 401: Unauthorized'))).toBe(false)
  })

  it('does NOT retry null/undefined', () => {
    expect(isRetryableError(null)).toBe(false)
    expect(isRetryableError(undefined)).toBe(false)
  })

  it('does NOT retry plain strings', () => {
    expect(isRetryableError('some error')).toBe(false)
  })
})

// ─── calculateDelay ──────────────────────────────────────────

describe('calculateDelay', () => {
  it('returns ~1000ms for attempt 1', () => {
    const delay = calculateDelay(1, 1000, 16000, 0)
    expect(delay).toBe(1000)
  })

  it('returns ~4000ms for attempt 2', () => {
    const delay = calculateDelay(2, 1000, 16000, 0)
    expect(delay).toBe(4000)
  })

  it('returns ~16000ms for attempt 3', () => {
    const delay = calculateDelay(3, 1000, 16000, 0)
    expect(delay).toBe(16000)
  })

  it('caps at maxDelayMs', () => {
    const delay = calculateDelay(4, 1000, 16000, 0)
    expect(delay).toBe(16000) // 64000 capped to 16000
  })

  it('applies jitter within expected range', () => {
    const delays = Array.from({ length: 100 }, () => calculateDelay(1, 1000, 16000, 0.25))
    const min = Math.min(...delays)
    const max = Math.max(...delays)
    expect(min).toBeGreaterThanOrEqual(750) // 1000 - 25%
    expect(max).toBeLessThanOrEqual(1250) // 1000 + 25%
  })

  it('returns 0 for base delay 0', () => {
    const delay = calculateDelay(1, 0, 16000, 0)
    expect(delay).toBe(0)
  })
})

// ─── withRetry ───────────────────────────────────────────────

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValueOnce('success')
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on retryable error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Telegram API 502: Bad Gateway'))
      .mockResolvedValueOnce('success')

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, jitter: 0 })
    // Advance past the 10ms delay
    await vi.advanceTimersByTimeAsync(50)
    const result = await promise
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry on non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('WhatsApp API 400: Invalid parameter'))

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 }),
    ).rejects.toThrow('400')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws after all attempts exhausted', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('API 502: Bad Gateway'))
      .mockRejectedValueOnce(new Error('API 502: Bad Gateway'))
      .mockRejectedValueOnce(new Error('API 502: Bad Gateway'))

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, jitter: 0 })
    // Suppress unhandled rejection during timer advancement
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(200)
    await expect(promise).rejects.toThrow('502')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('respects custom isRetryable predicate', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('custom error'))
    const isRetryable = vi.fn().mockReturnValue(false)

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, isRetryable }),
    ).rejects.toThrow('custom error')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(isRetryable).toHaveBeenCalledOnce()
  })

  it('works with void-returning functions', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(undefined)

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, jitter: 0 })
    await vi.advanceTimersByTimeAsync(50)
    const result = await promise
    expect(result).toBeUndefined()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('defaults to 3 attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'))

    const promise = withRetry(fn, { baseDelayMs: 10, jitter: 0 })
    // Suppress unhandled rejection during timer advancement
    promise.catch(() => {})
    await vi.advanceTimersByTimeAsync(200)
    await expect(promise).rejects.toThrow('fetch failed')
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
