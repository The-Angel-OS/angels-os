/**
 * apiRateLimiter — Unit Tests
 *
 * extractRateLimitKey, checkApiRateLimit, rateLimitResponse, applyRateLimit
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  extractRateLimitKey,
  checkApiRateLimit,
  rateLimitResponse,
  applyRateLimit,
} from '@/utilities/apiRateLimiter'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeHeaders(values: Record<string, string | null> = {}) {
  return {
    get: (name: string) => values[name.toLowerCase()] ?? null,
  }
}

function makeReq(userId?: number | string | null, headerValues: Record<string, string | null> = {}) {
  return {
    user: userId != null ? { id: userId } : null,
    headers: makeHeaders(headerValues),
  }
}

// ── extractRateLimitKey ────────────────────────────────────────────────────────

describe('extractRateLimitKey', () => {
  it('uses user id when authenticated', () => {
    const key = extractRateLimitKey(makeReq(42))
    expect(key).toBe('user:42')
  })

  it('uses cf-connecting-ip when user is not authenticated', () => {
    const key = extractRateLimitKey(makeReq(null, { 'cf-connecting-ip': '1.2.3.4' }))
    expect(key).toBe('ip:1.2.3.4')
  })

  it('falls back to x-forwarded-for', () => {
    const key = extractRateLimitKey(makeReq(null, { 'x-forwarded-for': '5.6.7.8, proxy' }))
    expect(key).toBe('ip:5.6.7.8')
  })

  it('falls back to x-real-ip', () => {
    const key = extractRateLimitKey(makeReq(null, { 'x-real-ip': '9.0.0.1' }))
    expect(key).toBe('ip:9.0.0.1')
  })

  it('uses "unknown" when no IP information is available', () => {
    const key = extractRateLimitKey(makeReq(null))
    expect(key).toBe('ip:unknown')
  })

  it('prefers cf-connecting-ip over x-forwarded-for', () => {
    const key = extractRateLimitKey(
      makeReq(null, { 'cf-connecting-ip': '11.22.33.44', 'x-forwarded-for': '99.99.99.99' }),
    )
    expect(key).toBe('ip:11.22.33.44')
  })
})

// ── checkApiRateLimit ──────────────────────────────────────────────────────────

describe('checkApiRateLimit', () => {
  it('allows first request', () => {
    const result = checkApiRateLimit(`unique_key_${Date.now()}_a`, 'default')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeGreaterThan(0)
  })

  it('returns the limit in the result', () => {
    const result = checkApiRateLimit(`unique_key_${Date.now()}_b`, 'leo_chat')
    expect(result.limit).toBe(10) // leo_chat limit
  })

  it('denies after exceeding the limit', () => {
    const key = `test_exceed_${Date.now()}_${Math.random()}`
    // leo_stream has limit=5; exhaust it
    for (let i = 0; i < 5; i++) {
      checkApiRateLimit(key, 'leo_stream')
    }
    const result = checkApiRateLimit(key, 'leo_stream')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('decrements remaining on each request', () => {
    const key = `test_decrement_${Date.now()}_${Math.random()}`
    const first = checkApiRateLimit(key, 'registration') // limit=3
    const second = checkApiRateLimit(key, 'registration')
    expect(second.remaining).toBeLessThan(first.remaining)
  })
})

// ── rateLimitResponse ─────────────────────────────────────────────────────────

describe('rateLimitResponse', () => {
  it('returns a 429 Response', async () => {
    const res = rateLimitResponse({ allowed: false, remaining: 0, limit: 10, retryAfterSeconds: 45 })
    expect(res.status).toBe(429)
  })

  it('includes Retry-After header', () => {
    const res = rateLimitResponse({ allowed: false, remaining: 0, limit: 10, retryAfterSeconds: 30 })
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('body contains error message', async () => {
    const res = rateLimitResponse({ allowed: false, remaining: 0, limit: 10, retryAfterSeconds: 5 })
    const body = await res.json()
    expect(body.error).toMatch(/too many requests/i)
    expect(body.retryAfter).toBe(5)
  })
})

// ── applyRateLimit ────────────────────────────────────────────────────────────

describe('applyRateLimit', () => {
  it('returns null when within limit', () => {
    const req = makeReq(`unique_id_${Date.now()}_${Math.random()}`)
    const result = applyRateLimit(req, 'default')
    expect(result).toBeNull()
  })

  it('returns a 429 Response when limit exceeded', () => {
    const uniqueId = `throttle_${Date.now()}_${Math.random()}`
    const req = { user: { id: uniqueId }, headers: makeHeaders() }
    // registration has limit=3; exhaust it
    for (let i = 0; i < 3; i++) {
      applyRateLimit(req, 'registration')
    }
    const blocked = applyRateLimit(req, 'registration')
    expect(blocked).not.toBeNull()
    expect(blocked!.status).toBe(429)
  })
})
