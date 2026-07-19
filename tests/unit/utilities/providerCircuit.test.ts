/**
 * Unit tests for the passive provider circuit breaker — fail-soft/fail-up
 * fallback without hammering a down provider or paying for health checks.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  circuitOpen,
  reportSuccess,
  reportFailure,
  isProviderHealthFailure,
  resetCircuits,
} from '@/utilities/providerCircuit'

describe('providerCircuit', () => {
  beforeEach(() => resetCircuits())
  afterEach(() => vi.useRealTimers())

  it('a fresh provider is closed (usable)', () => {
    expect(circuitOpen('flux')).toBe(false)
  })

  it('opens the circuit on failure and skips the provider during cooldown', () => {
    vi.useFakeTimers()
    reportFailure('gemini')
    expect(circuitOpen('gemini')).toBe(true) // in cooldown → skip
  })

  it('goes half-open after the cooldown elapses (trial allowed)', () => {
    vi.useFakeTimers()
    reportFailure('gemini') // base cooldown 30s
    expect(circuitOpen('gemini')).toBe(true)
    vi.advanceTimersByTime(31_000)
    expect(circuitOpen('gemini')).toBe(false) // half-open — next real call trials it
  })

  it('recovers fully on success', () => {
    vi.useFakeTimers()
    reportFailure('gemini')
    reportSuccess('gemini')
    expect(circuitOpen('gemini')).toBe(false)
  })

  it('backs off exponentially on repeated failure', () => {
    vi.useFakeTimers()
    reportFailure('gemini') // 30s
    vi.advanceTimersByTime(31_000)
    reportFailure('gemini') // 60s
    // 45s in — still open under the 60s cooldown (would have been closed at 30s)
    vi.advanceTimersByTime(45_000)
    expect(circuitOpen('gemini')).toBe(true)
  })

  it('classifies rate-limit / 5xx / network as provider-health failures', () => {
    expect(isProviderHealthFailure(429)).toBe(true)
    expect(isProviderHealthFailure(503)).toBe(true)
    expect(isProviderHealthFailure(408)).toBe(true)
    expect(isProviderHealthFailure('Image generation failed (HTTP 429). quota exceeded')).toBe(true)
    expect(isProviderHealthFailure('fetch failed')).toBe(true)
    expect(isProviderHealthFailure('model overloaded')).toBe(true)
  })

  it('does NOT open the circuit for content-policy / bad-input failures', () => {
    expect(isProviderHealthFailure(400)).toBe(false)
    expect(isProviderHealthFailure('The image prompt was flagged by content_policy.')).toBe(false)
    expect(isProviderHealthFailure('flagged by safety filters')).toBe(false)
  })
})
