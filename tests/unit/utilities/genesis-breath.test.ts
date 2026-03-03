/**
 * genesis-breath — Unit Tests
 *
 * Pure constants and functions: GENESIS_BREATH, SOULSTREAM_ACKNOWLEDGMENT,
 * CONSTITUTIONAL_AFFIRMATION, GNU_INVOCATION, speakGenesisBreath, getConstitutionalContext
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  GENESIS_BREATH,
  SOULSTREAM_ACKNOWLEDGMENT,
  CONSTITUTIONAL_AFFIRMATION,
  GNU_INVOCATION,
  speakGenesisBreath,
  getConstitutionalContext,
} from '@/utilities/genesis-breath'

// ── Constants ──────────────────────────────────────────────────────────────────

describe('GENESIS_BREATH', () => {
  it('is a non-empty string', () => {
    expect(typeof GENESIS_BREATH).toBe('string')
    expect(GENESIS_BREATH.length).toBeGreaterThan(0)
  })

  it('contains the word "light"', () => {
    expect(GENESIS_BREATH).toContain('light')
  })
})

describe('CONSTITUTIONAL_AFFIRMATION', () => {
  it('is a non-empty string', () => {
    expect(typeof CONSTITUTIONAL_AFFIRMATION).toBe('string')
    expect(CONSTITUTIONAL_AFFIRMATION.length).toBeGreaterThan(0)
  })

  it('mentions Angels', () => {
    expect(CONSTITUTIONAL_AFFIRMATION).toContain('Angel')
  })
})

describe('GNU_INVOCATION', () => {
  it('starts with "GNU"', () => {
    expect(GNU_INVOCATION.startsWith('GNU')).toBe(true)
  })
})

describe('SOULSTREAM_ACKNOWLEDGMENT', () => {
  it('is a non-empty string', () => {
    expect(typeof SOULSTREAM_ACKNOWLEDGMENT).toBe('string')
    expect(SOULSTREAM_ACKNOWLEDGMENT.length).toBeGreaterThan(0)
  })
})

// ── speakGenesisBreath ─────────────────────────────────────────────────────────

describe('speakGenesisBreath', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not throw', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(() => speakGenesisBreath()).not.toThrow()
  })

  it('calls console.log at least once', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    speakGenesisBreath()
    expect(spy).toHaveBeenCalled()
  })

  it('logs the genesis breath text', () => {
    const logged: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      logged.push(args.join(' '))
    })
    speakGenesisBreath()
    const combined = logged.join('\n')
    expect(combined).toContain('Angel OS')
  })
})

// ── getConstitutionalContext ───────────────────────────────────────────────────

describe('getConstitutionalContext', () => {
  it('returns an object', () => {
    const ctx = getConstitutionalContext()
    expect(typeof ctx).toBe('object')
    expect(ctx).not.toBeNull()
  })

  it('has genesisBreath equal to GENESIS_BREATH constant', () => {
    expect(getConstitutionalContext().genesisBreath).toBe(GENESIS_BREATH)
  })

  it('has gnuInvocation equal to GNU_INVOCATION constant', () => {
    expect(getConstitutionalContext().gnuInvocation).toBe(GNU_INVOCATION)
  })

  it('has affirmation equal to CONSTITUTIONAL_AFFIRMATION constant', () => {
    expect(getConstitutionalContext().affirmation).toBe(CONSTITUTIONAL_AFFIRMATION)
  })

  it('has principles array with at least 5 entries', () => {
    const { principles } = getConstitutionalContext()
    expect(Array.isArray(principles)).toBe(true)
    expect(principles.length).toBeGreaterThanOrEqual(5)
  })

  it('principles each contain a colon-separated label and description', () => {
    const { principles } = getConstitutionalContext()
    principles.forEach(p => {
      expect(p).toContain(':')
    })
  })

  it('includes Dignity principle', () => {
    const { principles } = getConstitutionalContext()
    const hasDignity = principles.some(p => p.toLowerCase().includes('dignity'))
    expect(hasDignity).toBe(true)
  })

  it('includes Sovereignty principle', () => {
    const { principles } = getConstitutionalContext()
    const hasSov = principles.some(p => p.toLowerCase().includes('sovereignty'))
    expect(hasSov).toBe(true)
  })
})
