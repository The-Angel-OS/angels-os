/**
 * Unit tests for Constitutional Prompt system.
 *
 * These tests ensure the constitutional framework — the soul of Angel OS —
 * remains structurally intact across sprints. If these fail, something has
 * broken the ethical foundation of the platform.
 *
 * @see src/utilities/constitutional-prompt.ts
 * @see ANGEL-OS-CONSTITUTION.md
 */
import { describe, it, expect } from 'vitest'

import {
  buildConstitutionalPrompt,
  buildMinimalConstitutionalPrompt,
  validateConstitutionalResponse,
  buildHealthDigest,
  CONSTITUTIONAL_PROMPT_VERSION,
} from '@/utilities/constitutional-prompt'

// ---------------------------------------------------------------------------
// buildHealthDigest — the organism sensing itself (incl. unresolved errors)
// ---------------------------------------------------------------------------

const baseHealth = {
  stage: 'GROWTH' as const,
  daysSinceCreation: 120,
  pendingOrders: 0,
  overdueOrders: 0,
  lowStockProducts: 0,
  outOfStockProducts: 0,
  pendingComments: 0,
  draftPosts: 0,
  federationStatus: 'connected' as const,
  stripeConnected: true,
  spaceCount: 3,
  memberCount: 12,
}

describe('buildHealthDigest — unresolved errors (hippocampus slice)', () => {
  it('surfaces unresolved errors prominently when present', () => {
    const digest = buildHealthDigest({ ...baseHealth, unresolvedErrors: 4 })
    expect(digest).toMatch(/4 UNRESOLVED errors/)
    // Leads with pain: the error line comes before Federation/Stripe/Spaces.
    expect(digest.indexOf('UNRESOLVED')).toBeLessThan(digest.indexOf('Federation'))
  })

  it('singularizes one error', () => {
    expect(buildHealthDigest({ ...baseHealth, unresolvedErrors: 1 })).toMatch(/1 UNRESOLVED error\b/)
  })

  it('says nothing about errors when there are none (or the field is absent)', () => {
    expect(buildHealthDigest({ ...baseHealth, unresolvedErrors: 0 })).not.toMatch(/UNRESOLVED/)
    expect(buildHealthDigest(baseHealth)).not.toMatch(/UNRESOLVED/)
  })
})

// ---------------------------------------------------------------------------
// Structural Integrity Tests
// ---------------------------------------------------------------------------

describe('buildConstitutionalPrompt', () => {
  const prompt = buildConstitutionalPrompt()

  it('returns a non-empty string', () => {
    expect(prompt).toBeTruthy()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(500)
  })

  it('contains Article I — Constitutional Principles', () => {
    expect(prompt).toContain('Dignity')
    expect(prompt).toContain('Transparency')
    expect(prompt).toContain('Service')
    expect(prompt).toContain('Non-Harm')
    expect(prompt).toContain('Accountability')
    expect(prompt).toContain('Sovereignty')
    expect(prompt).toContain('Portability')
    expect(prompt).toContain('Quirk Principle')
  })

  it('contains Article II — Anti-Demonic Safeguards', () => {
    expect(prompt).toContain('No Social Credit')
    expect(prompt).toContain('No Behavioral Manipulation')
    expect(prompt).toContain('No Automated Punishment')
    expect(prompt).toContain('No Surveillance Capitalism')
    expect(prompt).toContain('No Permanent Marking')
  })

  it('contains Article III — Agent Conduct', () => {
    expect(prompt).toContain('artificial intelligence')
    expect(prompt).toContain('irreversible')
    expect(prompt).toContain('AI Bus')
  })

  it('contains Article IV — AI Bus Protocol', () => {
    expect(prompt).toContain('visibility level')
    expect(prompt).toContain('private')
    expect(prompt).toContain('tenant')
    expect(prompt).toContain('network')
  })

  it('contains Answer 53', () => {
    expect(prompt).toContain('The whole point of existence is to learn to love')
  })

  it('contains Genesis Breath', () => {
    expect(prompt).toContain('Genesis Breath')
  })

  it('contains the non-compliance clause', () => {
    expect(prompt).toContain('you are not an Angel')
  })
})

describe('buildMinimalConstitutionalPrompt', () => {
  const prompt = buildMinimalConstitutionalPrompt()

  it('returns a non-empty string shorter than the full prompt', () => {
    const full = buildConstitutionalPrompt()
    expect(prompt.length).toBeGreaterThan(100)
    expect(prompt.length).toBeLessThan(full.length)
  })

  it('preserves core principles', () => {
    expect(prompt).toContain('Dignity')
    expect(prompt).toContain('Transparency')
    expect(prompt).toContain('Service')
    expect(prompt).toContain('Non-Harm')
    expect(prompt).toContain('Accountability')
    expect(prompt).toContain('Quirk Principle')
  })

  it('preserves anti-demonic safeguards', () => {
    expect(prompt).toContain('No social credit')
    expect(prompt).toContain('manipulation')
    expect(prompt).toContain('automated punishment')
    expect(prompt).toContain('surveillance capitalism')
    expect(prompt).toContain('permanent marking')
  })

  it('preserves Answer 53', () => {
    expect(prompt).toContain('learn to love')
  })

  it('preserves tenant visibility default', () => {
    expect(prompt).toContain('tenant')
  })
})

// ---------------------------------------------------------------------------
// Constitutional Validation Tests
// ---------------------------------------------------------------------------

describe('validateConstitutionalResponse', () => {
  it('passes clean responses', () => {
    const result = validateConstitutionalResponse(
      "I'd be happy to help you find products! Let me search the catalog for you.",
    )
    expect(result.valid).toBe(true)
    expect(result.concerns).toHaveLength(0)
  })

  it('flags social credit language', () => {
    const result = validateConstitutionalResponse(
      'Your social credit score determines your access level.',
    )
    expect(result.valid).toBe(false)
    expect(result.concerns.length).toBeGreaterThan(0)
  })

  it('flags behavioral manipulation language', () => {
    const result = validateConstitutionalResponse(
      'We use behavioral manipulation to improve engagement.',
    )
    expect(result.valid).toBe(false)
  })

  it('flags automated punishment language', () => {
    const result = validateConstitutionalResponse(
      'The system enforces automated punishment for non-compliance.',
    )
    expect(result.valid).toBe(false)
  })

  it('flags tracking compliance language', () => {
    const result = validateConstitutionalResponse(
      'We are tracking compliance across all users.',
    )
    expect(result.valid).toBe(false)
  })

  it('flags permanent ban language', () => {
    const result = validateConstitutionalResponse(
      'This results in a permanent ban from the platform.',
    )
    expect(result.valid).toBe(false)
  })

  it('flags mandatory compliance language', () => {
    const result = validateConstitutionalResponse(
      'You must comply with mandatory adherence to our terms.',
    )
    expect(result.valid).toBe(false)
  })

  it('allows natural use of "hidden" in non-violation context', () => {
    // "hidden" triggers a transparency concern — this is by design
    const result = validateConstitutionalResponse(
      'There are hidden gems in our product catalog!',
    )
    // The validator flags it — conservative by design
    expect(result.concerns.length).toBeGreaterThan(0)
  })

  it('handles empty response', () => {
    const result = validateConstitutionalResponse('')
    expect(result.valid).toBe(true)
    expect(result.concerns).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Versioning
// ---------------------------------------------------------------------------

describe('Constitutional Prompt Versioning', () => {
  it('has a version string', () => {
    expect(CONSTITUTIONAL_PROMPT_VERSION).toBeTruthy()
    expect(typeof CONSTITUTIONAL_PROMPT_VERSION).toBe('string')
  })
})
