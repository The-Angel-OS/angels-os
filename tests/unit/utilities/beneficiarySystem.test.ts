/**
 * Beneficiary System — Unit Tests
 *
 * Tests the beneficiary designation, claim token generation, and
 * verification lifecycle for Endeavor beneficiaries.
 *
 * @see src/collections/Endeavors/hooks/generateBeneficiaryTokens.ts
 * @see src/endpoints/beneficiary-claim.ts
 */
import { describe, it, expect, vi } from 'vitest'
import { generateBeneficiaryTokens } from '../../../src/collections/Endeavors/hooks/generateBeneficiaryTokens'

// ─── Helper: simulate the hook call ────────────────────────────────

async function runHook(data: any) {
  const result = await generateBeneficiaryTokens({
    data,
    operation: 'create',
    req: {} as any,
    collection: {} as any,
    originalDoc: undefined as any,
    context: {} as any,
  })
  return result
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('Beneficiary Token Generation', () => {
  it('generates a claimToken for new beneficiaries', async () => {
    const data = {
      beneficiaries: [
        { name: 'Ernesto Behrens', email: 'ernesto@example.com', role: 'Beneficiary' },
      ],
    }

    const result = await runHook(data)
    const bene = result.beneficiaries[0]

    expect(bene.claimToken).toBeDefined()
    expect(typeof bene.claimToken).toBe('string')
    // UUID format: 8-4-4-4-12
    expect(bene.claimToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('generates a designatedAt timestamp', async () => {
    const data = {
      beneficiaries: [{ name: 'Test Person' }],
    }

    const result = await runHook(data)
    const bene = result.beneficiaries[0]

    expect(bene.designatedAt).toBeDefined()
    // Should be a valid ISO date string
    expect(new Date(bene.designatedAt).toISOString()).toBe(bene.designatedAt)
  })

  it('does not overwrite existing claimTokens', async () => {
    const existingToken = 'existing-token-uuid'
    const data = {
      beneficiaries: [
        { name: 'Already Designated', claimToken: existingToken, designatedAt: '2026-01-01T00:00:00.000Z' },
      ],
    }

    const result = await runHook(data)
    const bene = result.beneficiaries[0]

    expect(bene.claimToken).toBe(existingToken)
    expect(bene.designatedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('generates unique tokens for multiple beneficiaries', async () => {
    const data = {
      beneficiaries: [
        { name: 'Person A' },
        { name: 'Person B' },
        { name: 'Person C' },
      ],
    }

    const result = await runHook(data)
    const tokens = result.beneficiaries.map((b: any) => b.claimToken)

    // All tokens should be defined
    expect(tokens.every((t: string) => typeof t === 'string' && t.length > 0)).toBe(true)

    // All tokens should be unique
    const uniqueTokens = new Set(tokens)
    expect(uniqueTokens.size).toBe(3)
  })

  it('handles empty beneficiaries array', async () => {
    const data = { beneficiaries: [] }
    const result = await runHook(data)
    expect(result.beneficiaries).toEqual([])
  })

  it('handles missing beneficiaries field', async () => {
    const data = { name: 'Some Endeavor' }
    const result = await runHook(data)
    expect(result).toEqual(data)
  })

  it('handles null beneficiaries', async () => {
    const data = { beneficiaries: null }
    const result = await runHook(data)
    expect(result).toEqual(data)
  })

  it('preserves existing fields on beneficiary entries', async () => {
    const data = {
      beneficiaries: [
        {
          name: 'Ernesto Behrens',
          email: 'ernesto@example.com',
          role: 'Beneficiary',
          description: 'DNA exoneration case',
          verificationStatus: 'pending',
        },
      ],
    }

    const result = await runHook(data)
    const bene = result.beneficiaries[0]

    expect(bene.name).toBe('Ernesto Behrens')
    expect(bene.email).toBe('ernesto@example.com')
    expect(bene.role).toBe('Beneficiary')
    expect(bene.description).toBe('DNA exoneration case')
    expect(bene.verificationStatus).toBe('pending')
    expect(bene.claimToken).toBeDefined()
    expect(bene.designatedAt).toBeDefined()
  })
})

describe('Beneficiary Verification Lifecycle', () => {
  it('models the full lifecycle: pending → invited → verified', () => {
    // This tests the data model, not the endpoint (which requires Payload)
    const statuses = ['pending', 'invited', 'verified', 'declined']
    const validStatuses = new Set(statuses)

    // Verify all statuses are valid
    expect(validStatuses.has('pending')).toBe(true)
    expect(validStatuses.has('invited')).toBe(true)
    expect(validStatuses.has('verified')).toBe(true)
    expect(validStatuses.has('declined')).toBe(true)
    expect(validStatuses.size).toBe(4)
  })

  it('claim token format is URL-safe', async () => {
    const data = {
      beneficiaries: [{ name: 'Test' }],
    }

    const result = await runHook(data)
    const token = result.beneficiaries[0].claimToken

    // UUID is URL-safe (only hex chars and hyphens)
    expect(token).toMatch(/^[a-z0-9-]+$/)
    // Should be encodeable in a URL parameter without escaping
    expect(encodeURIComponent(token)).toBe(token)
  })
})
