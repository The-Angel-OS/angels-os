/**
 * Federation Skills — Unit Tests
 *
 * Tests validateSkillDefinition, checkSpendingGuardrails, DEFAULT_SPENDING_GUARDRAILS.
 * Pure functions — no mocks needed.
 */
import { describe, it, expect } from 'vitest'

import {
  validateSkillDefinition,
  checkSpendingGuardrails,
  DEFAULT_SPENDING_GUARDRAILS,
  type FederationSkill,
  type SpendingGuardrails,
  type SkillCategory,
} from '@/federation/skills'

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeValidSkill(overrides: Partial<FederationSkill> = {}): FederationSkill {
  return {
    name: 'search_catalog',
    version: '1.0.0',
    description: 'Search product catalog across the federation',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'array' },
    costCents: 0,
    rateLimit: 100,
    requiresTrust: 'probationary',
    category: 'catalog',
    safety: {
      canModifyUserData: false,
      sideEffects: [],
    },
    enabled: true,
    ...overrides,
  }
}

// ── DEFAULT_SPENDING_GUARDRAILS ─────────────────────────────────────────────

describe('DEFAULT_SPENDING_GUARDRAILS', () => {
  it('has maxPerTransactionCents of 1000 ($10)', () => {
    expect(DEFAULT_SPENDING_GUARDRAILS.maxPerTransactionCents).toBe(1000)
  })

  it('has maxDailySpendCents of 5000 ($50)', () => {
    expect(DEFAULT_SPENDING_GUARDRAILS.maxDailySpendCents).toBe(5000)
  })

  it('has monthlyBudgetCents of 10000 ($100)', () => {
    expect(DEFAULT_SPENDING_GUARDRAILS.monthlyBudgetCents).toBe(10000)
  })

  it('allows catalog category', () => {
    expect(DEFAULT_SPENDING_GUARDRAILS.allowedCategories).toContain('catalog')
  })

  it('allows booking category', () => {
    expect(DEFAULT_SPENDING_GUARDRAILS.allowedCategories).toContain('booking')
  })

  it('allows content category', () => {
    expect(DEFAULT_SPENDING_GUARDRAILS.allowedCategories).toContain('content')
  })

  it('does NOT allow payment category by default', () => {
    expect(DEFAULT_SPENDING_GUARDRAILS.allowedCategories).not.toContain('payment')
  })

  it('has humanApprovalThresholdCents of 500 ($5)', () => {
    expect(DEFAULT_SPENDING_GUARDRAILS.humanApprovalThresholdCents).toBe(500)
  })
})

// ── validateSkillDefinition ────────────────────────────────────────────────

describe('validateSkillDefinition', () => {
  it('returns valid=true for a valid skill', () => {
    const result = validateSkillDefinition(makeValidSkill())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns error when name is empty', () => {
    const result = validateSkillDefinition(makeValidSkill({ name: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('name'))).toBe(true)
  })

  it('returns error when version is not semver', () => {
    const result = validateSkillDefinition(makeValidSkill({ version: '1.0' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('semver'))).toBe(true)
  })

  it('accepts valid semver versions', () => {
    expect(validateSkillDefinition(makeValidSkill({ version: '2.3.4' })).valid).toBe(true)
    expect(validateSkillDefinition(makeValidSkill({ version: '10.0.0' })).valid).toBe(true)
  })

  it('returns error when description is too short (< 10 chars)', () => {
    const result = validateSkillDefinition(makeValidSkill({ description: 'Short' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('description'))).toBe(true)
  })

  it('returns error when data-modifying skill requires "none" trust', () => {
    const result = validateSkillDefinition(
      makeValidSkill({
        requiresTrust: 'none',
        safety: {
          canModifyUserData: true,
          sideEffects: ['creates records'],
        },
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Article II'))).toBe(true)
  })

  it('returns error when data-modifying skill has no declared side effects', () => {
    const result = validateSkillDefinition(
      makeValidSkill({
        requiresTrust: 'probationary',
        safety: {
          canModifyUserData: true,
          sideEffects: [], // empty — violation
        },
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('side effects'))).toBe(true)
  })

  it('passes when data-modifying skill has probationary trust and declared side effects', () => {
    const result = validateSkillDefinition(
      makeValidSkill({
        requiresTrust: 'probationary',
        safety: {
          canModifyUserData: true,
          sideEffects: ['creates booking record'],
        },
      }),
    )
    expect(result.valid).toBe(true)
  })

  it('returns error when human-interaction skill does not disclose AI origin', () => {
    const result = validateSkillDefinition(
      makeValidSkill({
        safety: {
          canModifyUserData: false,
          sideEffects: [],
          involvesHumanInteraction: true,
          disclosesAIOrigin: false,
        },
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('disclose AI origin'))).toBe(true)
  })

  it('passes when human-interaction skill discloses AI origin', () => {
    const result = validateSkillDefinition(
      makeValidSkill({
        safety: {
          canModifyUserData: false,
          sideEffects: [],
          involvesHumanInteraction: true,
          disclosesAIOrigin: true,
        },
      }),
    )
    expect(result.valid).toBe(true)
  })

  it('returns error when rateLimit is zero', () => {
    const result = validateSkillDefinition(makeValidSkill({ rateLimit: 0 }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Rate limit'))).toBe(true)
  })

  it('returns error when rateLimit is negative', () => {
    const result = validateSkillDefinition(makeValidSkill({ rateLimit: -1 }))
    expect(result.valid).toBe(false)
  })

  it('returns error when costCents is negative', () => {
    const result = validateSkillDefinition(makeValidSkill({ costCents: -1 }))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Cost'))).toBe(true)
  })

  it('accepts costCents of 0 (free)', () => {
    expect(validateSkillDefinition(makeValidSkill({ costCents: 0 })).valid).toBe(true)
  })

  it('collects multiple errors at once', () => {
    const result = validateSkillDefinition(
      makeValidSkill({ name: '', version: 'bad', description: 'tiny' }),
    )
    expect(result.errors.length).toBeGreaterThan(1)
  })
})

// ── checkSpendingGuardrails ────────────────────────────────────────────────

describe('checkSpendingGuardrails', () => {
  const G: SpendingGuardrails = {
    maxPerTransactionCents: 1000,
    maxDailySpendCents: 5000,
    monthlyBudgetCents: 10000,
    allowedCategories: ['catalog', 'booking'],
    humanApprovalThresholdCents: 500,
  }

  it('allows a small transaction in an allowed category', () => {
    const result = checkSpendingGuardrails(G, 100, 'catalog', 0, 0)
    expect(result.allowed).toBe(true)
    expect(result.requiresHumanApproval).toBeFalsy()
  })

  it('denies spend in a disallowed category', () => {
    const result = checkSpendingGuardrails(G, 100, 'payment', 0, 0)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('payment')
  })

  it('denies spend exceeding per-transaction limit', () => {
    const result = checkSpendingGuardrails(G, 1500, 'catalog', 0, 0)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('per-transaction')
  })

  it('denies spend that would push over daily limit', () => {
    const result = checkSpendingGuardrails(G, 500, 'catalog', 4700, 0)
    // 4700 + 500 = 5200 > 5000
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('daily')
  })

  it('allows spend at exactly the daily limit', () => {
    // 4500 + 500 = 5000 === 5000, should be allowed
    const result = checkSpendingGuardrails(G, 500, 'catalog', 4500, 0)
    expect(result.allowed).toBe(true)
  })

  it('denies spend that would push over monthly budget', () => {
    const result = checkSpendingGuardrails(G, 500, 'catalog', 0, 9700)
    // 9700 + 500 = 10200 > 10000
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('monthly')
  })

  it('requires human approval when amount exceeds threshold', () => {
    const result = checkSpendingGuardrails(G, 600, 'catalog', 0, 0)
    expect(result.allowed).toBe(true)
    expect(result.requiresHumanApproval).toBe(true)
    expect(result.reason).toContain('threshold')
  })

  it('does not require human approval for amount at exactly the threshold', () => {
    const result = checkSpendingGuardrails(G, 500, 'catalog', 0, 0)
    // 500 is not > 500
    expect(result.allowed).toBe(true)
    expect(result.requiresHumanApproval).toBeFalsy()
  })

  it('checks category before per-transaction limit', () => {
    // Even a huge amount in a disallowed category should say "category" not "per-transaction"
    const result = checkSpendingGuardrails(G, 99999, 'payment', 0, 0)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('payment')
  })

  it('allows free (0 cent) transactions in allowed categories', () => {
    const result = checkSpendingGuardrails(G, 0, 'booking', 0, 0)
    expect(result.allowed).toBe(true)
  })
})
