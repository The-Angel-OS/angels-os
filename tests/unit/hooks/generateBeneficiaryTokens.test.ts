/**
 * generateBeneficiaryTokens Hook — Unit Tests
 *
 * Tests the beforeChange hook that auto-generates claimToken and designatedAt
 * for new beneficiary entries on Endeavors.
 */
import { describe, it, expect } from 'vitest'
import { generateBeneficiaryTokens } from '@/collections/Endeavors/hooks/generateBeneficiaryTokens'

// ── Helper ────────────────────────────────────────────────────────────────────

function makeArgs({
  data = {} as Record<string, unknown> | null | undefined,
  operation = 'create' as 'create' | 'update',
} = {}) {
  return {
    data,
    operation,
    req: {} as any,
    collection: null as any,
    context: {} as any,
    originalDoc: {} as any,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateBeneficiaryTokens', () => {
  // ── early exits ─────────────────────────────────────────────────────────────

  it('returns data unchanged when beneficiaries field is missing', async () => {
    const args = makeArgs({ data: { name: 'Test Endeavor' } })
    const result = await generateBeneficiaryTokens(args as any)
    expect(result).toEqual({ name: 'Test Endeavor' })
  })

  it('returns data unchanged when beneficiaries is null', async () => {
    const args = makeArgs({ data: { beneficiaries: null } })
    const result = await generateBeneficiaryTokens(args as any)
    expect(result).toEqual({ beneficiaries: null })
  })

  it('returns data unchanged when beneficiaries is not an array', async () => {
    const args = makeArgs({ data: { beneficiaries: 'invalid' } })
    const result = await generateBeneficiaryTokens(args as any)
    expect(result).toEqual({ beneficiaries: 'invalid' })
  })

  it('returns data unchanged when beneficiaries is a number', async () => {
    const args = makeArgs({ data: { beneficiaries: 42 } })
    const result = await generateBeneficiaryTokens(args as any)
    expect(result).toEqual({ beneficiaries: 42 })
  })

  it('returns null data unchanged', async () => {
    const args = makeArgs({ data: null })
    const result = await generateBeneficiaryTokens(args as any)
    expect(result).toBeNull()
  })

  // ── claimToken generation ────────────────────────────────────────────────────

  it('generates a claimToken for a beneficiary that lacks one', async () => {
    const args = makeArgs({ data: { beneficiaries: [{ name: 'Alice' }] } })
    const result = (await generateBeneficiaryTokens(args as any)) as any
    expect(typeof result.beneficiaries[0].claimToken).toBe('string')
    expect(result.beneficiaries[0].claimToken.length).toBeGreaterThan(0)
  })

  it('preserves an existing claimToken', async () => {
    const args = makeArgs({ data: { beneficiaries: [{ claimToken: 'my-custom-token-abc' }] } })
    const result = (await generateBeneficiaryTokens(args as any)) as any
    expect(result.beneficiaries[0].claimToken).toBe('my-custom-token-abc')
  })

  // ── designatedAt generation ──────────────────────────────────────────────────

  it('sets designatedAt for a beneficiary that lacks one', async () => {
    const before = new Date().toISOString()
    const args = makeArgs({ data: { beneficiaries: [{ name: 'Bob' }] } })
    const result = (await generateBeneficiaryTokens(args as any)) as any
    const after = new Date().toISOString()
    expect(result.beneficiaries[0].designatedAt).toBeTruthy()
    expect(result.beneficiaries[0].designatedAt >= before).toBe(true)
    expect(result.beneficiaries[0].designatedAt <= after).toBe(true)
  })

  it('preserves an existing designatedAt', async () => {
    const existingDate = '2022-06-15T00:00:00.000Z'
    const args = makeArgs({ data: { beneficiaries: [{ designatedAt: existingDate }] } })
    const result = (await generateBeneficiaryTokens(args as any)) as any
    expect(result.beneficiaries[0].designatedAt).toBe(existingDate)
  })

  // ── multiple beneficiaries ───────────────────────────────────────────────────

  it('handles multiple beneficiaries — generates for missing, preserves for existing', async () => {
    const args = makeArgs({
      data: {
        beneficiaries: [
          { name: 'Alice', claimToken: 'alice-token' }, // has token, no designatedAt
          { name: 'Bob' },                               // no token, no designatedAt
        ],
      },
    })
    const result = (await generateBeneficiaryTokens(args as any)) as any
    // Alice: token preserved, designatedAt generated
    expect(result.beneficiaries[0].claimToken).toBe('alice-token')
    expect(result.beneficiaries[0].designatedAt).toBeTruthy()
    // Bob: both generated
    expect(typeof result.beneficiaries[1].claimToken).toBe('string')
    expect(result.beneficiaries[1].claimToken.length).toBeGreaterThan(0)
    expect(result.beneficiaries[1].designatedAt).toBeTruthy()
  })

  it('all beneficiaries in a single call share the same designatedAt timestamp', async () => {
    const args = makeArgs({
      data: {
        beneficiaries: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }],
      },
    })
    const result = (await generateBeneficiaryTokens(args as any)) as any
    const ts0 = result.beneficiaries[0].designatedAt
    const ts1 = result.beneficiaries[1].designatedAt
    const ts2 = result.beneficiaries[2].designatedAt
    // All set to the same `now` captured at the start of the hook call
    expect(ts0).toBe(ts1)
    expect(ts1).toBe(ts2)
  })

  it('processes an empty beneficiaries array without error', async () => {
    const args = makeArgs({ data: { beneficiaries: [] } })
    const result = (await generateBeneficiaryTokens(args as any)) as any
    expect(result.beneficiaries).toEqual([])
  })
})
